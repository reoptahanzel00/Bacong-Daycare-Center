import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Proving that a parent's email address is really theirs.
 *
 * Absence alerts are emailed and they name the child — "Mateo has 3 consecutive
 * absences". A mistyped address at sign-up therefore sends a child's name and
 * attendance record to a stranger, and the parent it was meant for never learns
 * their child has been absent three days running.
 *
 * What this is NOT
 * ----------------
 * It is not Supabase's email confirmation, which gates sign-in. Gating sign-in
 * is precisely how every self-registered parent was locked out: the account was
 * created unconfirmed on the belief that a link was being sent, and none ever
 * was. Verification here never blocks sign-in and never blocks the portal. An
 * unverified parent uses the system normally and still sees every notification
 * in their feed; the only thing withheld is outbound email, which is the one
 * channel that can reach the wrong person.
 *
 * The token is random, single-use, time-limited, and stored only as a SHA-256
 * digest, so a leaked `users` row cannot be used to verify somebody's address.
 */

/** How long a verification link stays usable. */
export const VERIFICATION_TTL_HOURS = 72;

/** Hex digest of a token, which is all that is ever written to the database. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A fresh token and the digest to store alongside it. */
export function createVerificationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

/**
 * Constant-time digest comparison.
 *
 * The lookup is by digest, so an attacker cannot learn a token by timing the
 * query — but the final equality check should not leak either, and this costs
 * nothing.
 */
export function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Whether a link sent at `sentAt` is still within its window. */
export function isWithinTtl(sentAt: string | null | undefined): boolean {
  if (!sentAt) return false;
  const sent = new Date(sentAt).getTime();
  if (Number.isNaN(sent)) return false;
  return Date.now() - sent <= VERIFICATION_TTL_HOURS * 60 * 60 * 1000;
}

/**
 * The address the verification link points at.
 *
 * Falls back to the request's own origin so a preview deployment links to
 * itself rather than to production.
 */
export function appOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

export interface VerificationDispatch {
  /** The link was handed to the email provider. */
  sent: boolean;
  /** No provider is configured, so no link could be sent to anybody. */
  skipped: boolean;
}

/**
 * Issues a verification token for `userId` and emails the link.
 *
 * Best effort by design: a provider outage must not fail the registration that
 * triggered it. The caller reports what actually happened rather than claiming
 * an email is on its way.
 */
export async function sendVerificationEmail(
  admin: AdminClient,
  userId: string,
  email: string,
  fullName: string,
  origin: string
): Promise<VerificationDispatch> {
  const { token, hash } = createVerificationToken();

  const { error } = await admin
    .from('users')
    .update({
      email_verification_token_hash: hash,
      email_verification_sent_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.warn('[EmailVerification] Could not store token:', error.message);
    return { sent: false, skipped: false };
  }

  const link = `${origin}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const result = await sendEmail({
    to: email,
    subject: 'Confirm your email for the Barangay Bacong Daycare Center',
    text:
      `Hello ${fullName},\n\n` +
      'Please confirm this email address so the Daycare Worker can reach you ' +
      "about your child's attendance:\n\n" +
      `${link}\n\n` +
      `The link works for ${VERIFICATION_TTL_HOURS} hours. You can sign in and use ` +
      'the parent portal right away either way — confirming only turns on email ' +
      'alerts.\n\n' +
      'If you did not create this account, you can ignore this message.\n\n' +
      '— Barangay Bacong Daycare Center',
  });

  if (result.skipped) return { sent: false, skipped: true };
  return { sent: Boolean(result.sent), skipped: false };
}
