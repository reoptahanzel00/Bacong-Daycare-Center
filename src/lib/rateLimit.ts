import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiter for public/auth surfaces (per IP + action).
 *
 * Backed by Upstash Redis when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set, which is the only configuration where the
 * limit actually holds: every serverless instance gets its own memory, so an
 * in-process counter caps attempts per instance rather than per attacker.
 *
 * Without those variables it falls back to a shared in-process bucket. That is
 * fine for local development and single-node hosting, and is NOT a real limit
 * on serverless — provision the Redis store before relying on it in production.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

function hasRedisConfig(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

// One Ratelimit instance per (action, limit, window). Rebuilding it per request
// would discard the client's connection reuse and its ephemeral cache.
const limiters = new Map<string, Ratelimit>();

function getLimiter(action: string, limit: number, windowMs: number): Ratelimit {
  const key = `${action}:${limit}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `rl:${action}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/** In-process fallback. Shared memory only; resets on cold start. */
function localRateLimited(
  ip: string,
  action: string,
  limit: number,
  windowMs: number
): boolean {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/**
 * Returns true when this IP has exceeded `limit` requests for `action` within
 * `windowMs`, and the caller should reject with 429.
 *
 * If Redis is configured but unreachable, this degrades to the in-process
 * bucket rather than failing open (which would remove the limit entirely) or
 * failing closed (which would lock every user out of sign-in during an outage).
 */
export async function rateLimited(
  ip: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (!hasRedisConfig()) {
    return localRateLimited(ip, action, limit, windowMs);
  }

  try {
    const { success } = await getLimiter(action, limit, windowMs).limit(ip);
    return !success;
  } catch (e) {
    console.warn('[RateLimit] Redis unavailable, falling back to in-process bucket:', e);
    return localRateLimited(ip, action, limit, windowMs);
  }
}

/** Extracts the best-effort client IP from a request (Vercel-propagated). */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
