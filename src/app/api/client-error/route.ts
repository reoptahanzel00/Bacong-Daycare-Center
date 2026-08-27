import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimited, clientIp } from '@/lib/rateLimit';
import { getServerSession } from '@/lib/auth';

/**
 * Receives a crash report from the client ErrorBoundary.
 *
 * ErrorBoundary previously carried a comment saying "in production, send this to
 * an error monitoring service" and did nothing, so a view that threw for a
 * worker at 7am was invisible unless they thought to mention it.
 *
 * This deliberately carries NO record data: a message, a stack and a path. An
 * error report is the last place a child's name should end up, and crash
 * reports are the classic accidental PII leak.
 */

const ClientErrorSchema = z.object({
  message: z.string().max(500),
  componentStack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
});

// Generous enough for a genuine crash loop, tight enough that the endpoint
// cannot be used to flood the logs.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (await rateLimited(ip, 'client-error', RATE_LIMIT, RATE_WINDOW_MS)) {
      // Nothing useful to say to the client; it is fire-and-forget either way.
      return new NextResponse(null, { status: 429 });
    }

    const body = await request.json();
    const parsed = ClientErrorSchema.parse(body);

    // Role, not identity: enough to tell whether a crash is specific to one
    // portal, without putting a person in the log.
    const session = await getServerSession();

    console.error(
      JSON.stringify({
        kind: 'client-error',
        role: session.role ?? 'anonymous',
        path: parsed.path ?? null,
        message: parsed.message,
        componentStack: parsed.componentStack ?? null,
        at: new Date().toISOString(),
      })
    );

    return new NextResponse(null, { status: 204 });
  } catch {
    // Never let the reporter become a second source of errors.
    return new NextResponse(null, { status: 204 });
  }
}
