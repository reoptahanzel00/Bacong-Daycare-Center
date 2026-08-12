import { NextResponse } from 'next/server';
import { getServerSession, authorizeRole } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can list system accounts.' },
        { status: 403 }
      );
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('users')
      .select('id, email, full_name, role, phone, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ users: [], warning: error.message });
    }

    return NextResponse.json({ users: data || [] });
  } catch {
    // Admin client fails loudly when the service role key is missing.
    return NextResponse.json({ users: [], warning: 'User directory unavailable.' });
  }
}
