import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { notifyUsers } from '@/lib/notify';

const DecisionSchema = z.object({
  status: z.enum(['approved', 'declined']),
});

/**
 * PATCH — the Daycare Worker approves or declines an excuse letter.
 *
 * Approval also marks that day's absence as excused on the register (when the
 * absence has been recorded), and the parent is told either way. Each letter is
 * numbered per child ("Excuse 1", "Excuse 2", ...) so the parent and the worker
 * refer to the same one.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can approve excuse letters.' },
        { status: 403 }
      );
    }

    // The decision must be stated. An unreadable body used to count as an
    // approval, so a malformed "decline" approved the letter.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'State the decision: approved or declined.' }, { status: 400 });
    }
    const { status } = DecisionSchema.parse(body);

    const { id } = await params;
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('parent_notes')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, status, pupil_id, user_id, note_date, excuse_no')
      .maybeSingle();

    if (error) {
      console.error('[Parent Notes API] review failed:', error.message);
      return NextResponse.json({ error: 'Could not record the decision.' }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Excuse letter not found or already reviewed.' }, { status: 404 });
    }

    const label = `Excuse ${data.excuse_no ?? ''}`.trim();
    if (status === 'approved') {
      const { error: attError } = await admin
        .from('attendance')
        .update({ notes: `Excused (${label})` })
        .eq('pupil_id', data.pupil_id)
        .eq('date', data.note_date)
        .eq('status', 'absent');
      if (attError) console.warn('[Parent Notes API] attendance note warning:', attError.message);
    }

    if (data.user_id) {
      await notifyUsers([{ user_id: data.user_id, pupil_id: data.pupil_id }], {
        type: 'enrollment',
        title: status === 'approved' ? `${label.toUpperCase()} APPROVED` : `${label} declined`,
        message:
          status === 'approved'
            ? `Your ${label} for ${data.note_date} was approved by the Daycare Worker.`
            : `Your ${label} for ${data.note_date} was declined. Please contact the Daycare Worker.`,
        severity: status === 'approved' ? 'info' : 'medium',
      });
    }

    await recordAudit(admin, session, status === 'approved' ? 'Approved excuse letter' : 'Declined excuse letter', `Note ${id}`, label);

    return NextResponse.json({ success: true, note: { id: data.id, status: data.status } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
