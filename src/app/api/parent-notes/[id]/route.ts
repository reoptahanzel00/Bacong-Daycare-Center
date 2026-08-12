import { NextResponse } from 'next/server';
import { getServerSession, authorizeRole } from '@/lib/auth';

/** PATCH — worker/admin acknowledges an absence note. */
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Admins can acknowledge notes.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('parent_notes')
      .update({ status: 'acknowledged' })
      .eq('id', id)
      .select('id, status')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, note: data });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
