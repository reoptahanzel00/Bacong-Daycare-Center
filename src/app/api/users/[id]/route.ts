import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';

const UpdateUserSchema = z.object({
  status: z.enum(['active', 'disabled']),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can manage system accounts.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateUserSchema.parse(body);

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    if (parsed.status === 'disabled') {
      // Nobody can sign in to re-enable an account once no worker can sign
      // in, short of editing the database by hand.
      if (id === session.userId) {
        return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 400 });
      }
      const { data: target } = await admin.from('users').select('role').eq('id', id).maybeSingle();
      if (target?.role === 'worker') {
        const { count, error: countError } = await admin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'worker')
          .eq('status', 'active')
          .neq('id', id);
        if (countError || !count) {
          return NextResponse.json(
            { error: 'At least one Daycare Worker account must stay active.' },
            { status: 400 }
          );
        }
      }
    }

    const { data, error } = await admin
      .from('users')
      .update({ status: parsed.status })
      .eq('id', id)
      .select('id, email, full_name, role, phone, status, created_at')
      .single();

    if (error) {
      console.error('[Users API] status update failed:', error.message);
      return NextResponse.json({ error: 'Could not update the account.' }, { status: 400 });
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
      // of pretending the session was ended. The status change still reached the
      // database, so it still belongs in the audit trail - returning early
      // without recording it left the one status change most worth reviewing as
      // the only one with no entry.
      console.error('[Users API] Could not revoke sessions for', id, banError.message);
      await recordAudit(
        admin,
        session,
        parsed.status === 'disabled' ? 'Disabled user account' : 'Enabled user account',
        `User ${id}`,
        'Sessions could not be revoked'
      );
      return NextResponse.json({
        success: true,
        user: data,
        warning:
          parsed.status === 'disabled'
            ? 'Account disabled, but its active session could not be revoked. It will end when the token expires.'
            : 'Account re-enabled, but the sign-in block could not be lifted. The user may still be unable to sign in.',
      });
    }

    await recordAudit(admin, session, parsed.status === 'disabled' ? 'Disabled user account' : 'Enabled user account', `User ${id}`);

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
