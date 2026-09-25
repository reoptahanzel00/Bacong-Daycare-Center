import { NextResponse } from 'next/server';
import { rateLimited, clientIp } from '@/lib/rateLimit';
import { hashToken, digestsMatch, isWithinTtl } from '@/lib/emailVerification';
import { recordAudit } from '@/lib/audit';

/**
 * GET /auth/verify-email?token=… — marks a parent's email address as proven.
 *
 * Reached from the link in the sign-up email. Deliberately unauthenticated: the
 * point is to prove the address, and a parent reading their mail on a phone
 * they have not signed in on should still be able to confirm it. The token is
 * the only credential, so it is single-use and time-limited, and the row is
 * found by digest — the token itself is never stored.
 *
 * Every outcome lands on the sign-in page with a message, because a blank page
 * after clicking a link in an email is indistinguishable from a broken system.
 */

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function back(origin: string, param: 'notice' | 'error', message: string) {
  return NextResponse.redirect(`${origin}/login?${param}=${encodeURIComponent(message)}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  try {
    // The endpoint takes a guessable-shaped credential, so it is rate limited
    // like the other public auth surfaces.
    if (await rateLimited(clientIp(request), 'verify-email', RATE_LIMIT, RATE_WINDOW_MS)) {
      return back(origin, 'error', 'Too many attempts. Please try again later.');
    }

    const token = searchParams.get('token');
    if (!token) {
      return back(origin, 'error', 'That confirmation link is incomplete. Please use the link from your email.');
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const hash = hashToken(token);
    const { data: user, error } = await admin
      .from('users')
      .select('id, email, role, email_verified_at, email_verification_token_hash, email_verification_sent_at')
      .eq('email_verification_token_hash', hash)
      .maybeSingle();

    if (error) {
      console.error('[VerifyEmail] Lookup failed:', error.message);
      return back(origin, 'error', 'Could not confirm your email just now. Please try again.');
    }

    // One message for "no such token" and "wrong token": the link either works
    // or it does not, and saying which would make the endpoint an oracle.
    if (!user || !user.email_verification_token_hash || !digestsMatch(user.email_verification_token_hash, hash)) {
      return back(origin, 'error', 'That confirmation link is not valid. It may already have been used.');
    }

    if (!isWithinTtl(user.email_verification_sent_at)) {
      // Clear the dead token so the row does not keep a credential that can no
      // longer do anything.
      await admin
        .from('users')
        .update({ email_verification_token_hash: null })
        .eq('id', user.id);
      return back(origin, 'error', 'That confirmation link has expired. Please contact the Daycare Worker for a new one.');
    }

    if (user.email_verified_at) {
      await admin.from('users').update({ email_verification_token_hash: null }).eq('id', user.id);
      return back(origin, 'notice', 'Your email address is already confirmed. You can sign in.');
    }

    const { error: updateError } = await admin
      .from('users')
      .update({
        email_verified_at: new Date().toISOString(),
        // Single use.
        email_verification_token_hash: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[VerifyEmail] Update failed:', updateError.message);
      return back(origin, 'error', 'Could not confirm your email just now. Please try again.');
    }

    await recordAudit(
      admin,
      { userId: user.id, email: user.email, role: user.role },
      'Confirmed email address',
      `User ${user.id}`
    );

    return back(origin, 'notice', 'Thank you — your email address is confirmed. You can now sign in.');
  } catch (e) {
    console.error('[VerifyEmail] Unexpected failure:', e);
    return back(origin, 'error', 'Could not confirm your email just now. Please try again.');
  }
}
