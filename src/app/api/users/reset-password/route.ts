import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid('User ID must be a valid UUID'),
});

/**
 * POST — issues a password-recovery link for a parent account.
 *
 * The link is emailed to the parent when email delivery is configured, and is
 * also returned so the Daycare Worker can hand it over in person (many parents
 * are reached by phone, not email). It is single-use and short-lived, and it
 * is only issued for parent accounts: a worker must not be able to obtain a
 * sign-in link for a fellow worker. Workers reset their own password from the
 * sign-in page.
 *
 * The link carries a token_hash that /auth/callback verifies server-side. The
 * `action_link` Supabase returns uses the implicit flow (tokens in the URL
 * fragment), which the PKCE callback could not read, so it never worked.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can reset passwords.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = ResetPasswordSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('users')
      .select('email, role')
      .eq('id', parsed.user_id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    if (profile.role !== 'parent') {
      return NextResponse.json(
        { error: 'Daycare Worker accounts reset their own password from the sign-in page ("Forgot password").' },
        { status: 403 }
      );
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error('[Reset Password API] generateLink failed:', linkError?.message);
      return NextResponse.json({ error: 'Could not create a reset link. Please try again.' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resetLink =
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}` +
      `&type=recovery&next=${encodeURIComponent('/reset-password')}`;

    const { sendEmail } = await import('@/lib/email');
    const mail = await sendEmail({
      to: profile.email,
      subject: 'Reset your Bacong Daycare password',
      text:
        'The Daycare Worker started a password reset for your Barangay Bacong Daycare account.\n\n' +
        `Open this link to choose a new password (it works once and expires soon):\n${resetLink}\n\n` +
        'If you did not ask for this, you can ignore this email.',
    });
    const emailed = 'sent' in mail && mail.sent === true;

    await recordAudit(
      admin,
      session,
      'Issued password reset link',
      `User ${parsed.user_id}`,
      emailed ? 'Emailed to the account holder' : 'Shown to the worker to hand over'
    );

    return NextResponse.json({
      success: true,
      email: profile.email,
      emailed,
      reset_link: resetLink,
      message: emailed
        ? `A reset link was emailed to ${profile.email}.`
        : `Reset link created for ${profile.email}. Give it to the parent directly.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
