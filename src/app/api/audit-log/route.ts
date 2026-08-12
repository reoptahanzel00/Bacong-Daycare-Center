import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';

const AuditEntrySchema = z.object({
  action: z.string().min(1, 'Action is required').max(200),
  target: z.string().min(1, 'Target is required').max(200),
  details: z.string().max(1000).optional(),
});

/**
 * POST — appends a verified audit entry. The actor identity is derived
 * server-side from the verified session (never from client input), so entries
 * cannot be forged or attributed to someone else.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId || !session.role) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AuditEntrySchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // Resolve the actor display name server-side.
    const { data: profile } = await admin
      .from('users')
      .select('full_name')
      .eq('id', session.userId)
      .maybeSingle();

    const { error } = await admin.from('audit_log').insert({
      user_id: session.userId,
      user_name: profile?.full_name || session.email || 'System User',
      role: session.role,
      action: parsed.action,
      target: parsed.target,
      details: parsed.details || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** GET — admin-only read of the immutable audit trail. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (session.role !== 'barangay_admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Barangay Admins can view the audit trail.' },
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
