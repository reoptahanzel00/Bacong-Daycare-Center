import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const ResetPasswordSchema = z.object({
  user_id: z.string().uuid('User ID must be a valid UUID'),
});

/**
 * POST — generates a password-recovery link for the given account.
 * Admin-only. Supabase emails the link (when SMTP is configured); the link is
 * also returned so the admin can share it directly.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can reset passwords.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = ResetPasswordSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data: user, error: userError } = await admin.auth.admin.getUserById(parsed.user_id);
    if (userError || !user.user) {
      return NextResponse.json({ error: userError?.message || 'User not found.' }, { status: 404 });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: user.user.email as string,
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      email: user.user.email,
      reset_link: linkData.properties?.action_link || null,
      message: `Password reset link generated for ${user.user.email}.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
