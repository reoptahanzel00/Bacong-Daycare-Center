import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const UpdateUserSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can manage system accounts.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateUserSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('users')
      .update({ status: parsed.status })
      .eq('id', id)
      .select('id, email, full_name, role, phone, status, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Flipping the profile row stops every API call (getServerSession rejects a
    // disabled account), but it leaves the existing JWT valid, so the person
    // keeps a rendered shell until they happen to sign out. Ban the auth user
    // as well: that revokes their refresh tokens and blocks re-authentication
    // at the auth layer, so the session ends now rather than whenever the token
    // expires. Doing it here costs one call per status change, instead of a
    // status lookup on every request in the middleware.
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: parsed.status === 'disabled' ? '876000h' : 'none',
    });
    if (banError) {
      // The profile is already updated and authorization already fails closed,
      // so this is a degraded success rather than a failure: report it instead
      // of pretending the session was ended.
      console.error('[Users API] Could not revoke sessions for', id, banError.message);
      return NextResponse.json({
        success: true,
        user: data,
        warning:
          parsed.status === 'disabled'
            ? 'Account disabled, but its active session could not be revoked. It will end when the token expires.'
            : 'Account re-enabled, but the sign-in block could not be lifted. The user may still be unable to sign in.',
      });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
