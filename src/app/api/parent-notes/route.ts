import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { recordAudit } from '@/lib/audit';
import { notifyUsers, activeWorkerTargets } from '@/lib/notify';

const ParentNoteSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reason: z.string().min(1, 'Reason is required').max(200),
  notes: z.string().min(1, 'Note text is required').max(1000),
  phone: z.string().max(20).optional(),
});

/** GET — parents see their own notes; staff see all. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    // RLS-bound session client: parents select their own notes; staff select
    // all (policies in schema.sql). No service role needed for this read.
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('parent_notes')
      .select('*')
      .order('submitted_at', { ascending: false })
      .limit(200);
    if (error) {
      console.error('[API parent-notes] read failed:', error.message);
      return NextResponse.json({ notes: [], warning: 'Data unavailable.' });
    }
    return NextResponse.json({ notes: data || [] });
  } catch {
    return NextResponse.json({ notes: [], warning: 'Notes unavailable.' });
  }
}

/** POST — a parent submits an absence note for their linked child. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (session.role !== 'parent') {
      return NextResponse.json(
        { error: 'Only parents submit absence notes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = ParentNoteSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // Parents may only submit notes for children they are linked to.
    const { data: guardian } = await admin
      .from('guardians')
      .select('pupil_id')
      .eq('pupil_id', parsed.pupil_id)
      .eq('user_id', session.userId)
      .maybeSingle();
    if (!guardian) {
      return NextResponse.json(
        { error: 'You can only submit notes for your own child.' },
        { status: 403 }
      );
    }

    const { data, error } = await admin
      .from('parent_notes')
      .insert({
        pupil_id: parsed.pupil_id,
        user_id: session.userId,
        note_date: parsed.date,
        reason: parsed.reason,
        notes: parsed.notes,
        phone: parsed.phone || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[API parent-notes] write failed:', error.message);
      return NextResponse.json({ error: 'Could not save the change. Please try again.' }, { status: 400 });
    }
    // Tell the workers a letter is waiting. Without this the Parent Notes Inbox
    // was the only place a new letter showed up, so it sat unread until someone
    // happened to open that tab.
    const { data: pupil } = await admin
      .from('pupils')
      .select('first_name, last_name')
      .eq('id', parsed.pupil_id)
      .maybeSingle();
    const childName = pupil ? `${pupil.first_name} ${pupil.last_name}` : 'A pupil';
    await notifyUsers(await activeWorkerTargets(admin, parsed.pupil_id), {
      type: 'enrollment',
      title: 'New excuse letter',
      message: `${childName}'s parent sent an excuse letter for ${parsed.date}: ${parsed.reason}. Review it in the Parent Notes Inbox.`,
      severity: 'medium',
    });

    await recordAudit(admin, session, 'Submitted absence note', parsed.pupil_id, `For ${parsed.date}`);

    return NextResponse.json({ success: true, note: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
