import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/**
 * The trail is written only by the server routes that make each change
 * (src/lib/audit.ts). There is deliberately no POST: a browser-written trail
 * records only what the client chooses to report.
 */

/** GET — the Daycare Worker's read of the immutable audit trail. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (session.role !== 'worker') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can view the audit trail.' },
        { status: 403 }
      );
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ logs: [], warning: error.message });
    }
    return NextResponse.json({ logs: data || [] });
  } catch {
    return NextResponse.json({ logs: [], warning: 'Audit log unavailable.' });
  }
}
