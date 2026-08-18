/**
 * Lightweight in-memory rate limiter (per IP + action key).
 *
 * Best-effort protection for public/auth surfaces. This is shared, single-node
 * memory only: it resets on serverless cold starts and is not distributed.
 * For multi-instance deployments pair this with a shared store (Upstash/Redis)
 * or a gateway-level limiter (Vercel WAF) for stronger guarantees.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimited(
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

/** Extracts the best-effort client IP from a request (Vercel-propagated). */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
