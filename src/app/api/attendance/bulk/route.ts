import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { z } from 'zod';

const BulkAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  records: z.array(
    z.object({
      pupil_id: z.string().min(1),
      status: z.enum(['present', 'absent', 'late']),
      notes: z.string().max(500).optional(),
    })
  ).min(1, 'At least one record is required'),
});

import { getServerSession, authorizeRole } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { ABSENCE_ALERT_THRESHOLD } from '@/lib/absences';
import { todayLocalISO } from '@/lib/dates';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can record attendance registers.' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const parsed = BulkAttendanceSchema.parse(body);
    // A register records what happened. A date ahead of today at the centre
    // would mark children present or absent for a day that has not come.
    if (parsed.date > todayLocalISO()) {
      return NextResponse.json(
        { error: 'Attendance cannot be recorded for a future date.' },
        { status: 400 }
      );
    }

    // One row per pupil: a duplicate pupil_id in a single upsert makes
    // Postgres reject the whole register ("cannot affect row a second time").
    const latest = new Map(parsed.records.map((r) => [r.pupil_id, r]));
    const records = [...latest.values()].map((r) => ({
      pupil_id: r.pupil_id,
      date: parsed.date,
      status: r.status,
      // undefined = keep whatever note the row already has (an approved
      // excuse letter is recorded there); a string, even '', replaces it.
      notes: r.notes === undefined ? undefined : r.notes.trim(),
      recorded_by: session.userId,
    }));
    const pupilIds = records.map((r) => r.pupil_id);

    // Streaks before this save, so an alert goes out only when this register
    // made a streak reach or pass the threshold - not on every re-save of a
    // register that already contained the absences.
    let admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>;
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      admin = createAdminClient();
    } catch {
      console.error('[Attendance API] Database unavailable; register not saved.');
      return NextResponse.json(
        { success: false, error: 'The attendance register could not be saved. Please try again.' },
        { status: 503 }
      );
    }
    const { data: before, error: beforeError } = await admin
      .from('pupils')
      .select('id, enrollment_status, consecutive_absences')
      .in('id', pupilIds);
    if (beforeError) {
      console.error('[Attendance API] Pupil lookup failed:', beforeError.message);
      return NextResponse.json(
        { success: false, error: 'The attendance register could not be saved. Please try again.' },
        { status: 503 }
      );
    }
    const notEnrolled = pupilIds.filter(
      (id) => !(before || []).some((p) => p.id === id && p.enrollment_status === 'enrolled')
    );
    if (notEnrolled.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Attendance can only be recorded for enrolled children.' },
        { status: 400 }
      );
    }
    const priorStreak = new Map((before || []).map((p) => [p.id, p.consecutive_absences || 0]));

    // Try to persist to Supabase
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      // Rows with and without a note go in separate upserts: in one batch
      // PostgREST writes the union of columns, so a row sent without `notes`
      // would have its stored note overwritten with NULL.
      const withNotes = records.filter((r) => r.notes !== undefined);
      const withoutNotes = records
        .filter((r) => r.notes === undefined)
        .map((r) => ({ pupil_id: r.pupil_id, date: r.date, status: r.status, recorded_by: r.recorded_by }));
      let error: { message: string } | null = null;
      for (const batch of [withNotes, withoutNotes]) {
        if (batch.length === 0) continue;
        ({ error } = await supabase.from('attendance').upsert(batch, { onConflict: 'pupil_id,date' }));
        if (error) break;
      }

      if (error) {
        console.error('[Attendance API] Upsert error:', error.message);
        // Not saved. There is no offline queue, so say so rather than letting
        // the worker believe the register is stored.
        return NextResponse.json(
          { success: false, error: 'The attendance register could not be saved. Please try again.' },
          { status: 503 }
        );
      }

      // Notify linked guardians when a pupil reaches 3+ consecutive absences.
      // Deferred with after(): the worker marking a register should not wait on
      // guardian lookups and email delivery, which are slow and unrelated to
      // whether the register saved. after() still runs the work to completion on
      // the server, unlike a bare floating promise, which a serverless instance
      // may kill once the response is sent.
      after(async () => {
        try {
          const { notifyUsers, guardianUserIdsForPupils } = await import('@/lib/notify');

          const { data: affected } = await admin
            .from('pupils')
            .select('id, first_name, consecutive_absences')
            .in('id', pupilIds);

          const alertPupils = (affected || []).filter(
            (p) =>
              p.consecutive_absences >= ABSENCE_ALERT_THRESHOLD &&
              p.consecutive_absences > (priorStreak.get(p.id) ?? 0)
          );
          if (alertPupils.length === 0) return;

          // One notification per child, addressed to that child's own guardians.
          // A single combined message sent to the union of every alerted child's
          // guardians told each recipient the first name and the absence count of
          // every other child in the batch - other people's children.
          for (const pupil of alertPupils) {
            const targets = await guardianUserIdsForPupils(admin, [pupil.id]);
            if (targets.length === 0) continue;
            await notifyUsers(targets, {
              type: 'consecutive_absences',
              title: 'Absence Alert',
              message: `${pupil.first_name} has ${pupil.consecutive_absences} consecutive absences.`,
              channel: 'EMAIL',
              severity: 'high',
            });
          }
        } catch (alertError) {
          console.warn('[Attendance API] Absence alert skipped:', alertError);
        }
      });
    } catch {
      console.error('[Attendance API] Database unavailable; register not saved.');
      return NextResponse.json(
        { success: false, error: 'The attendance register could not be saved. Please try again.' },
        { status: 503 }
      );
    }

    {
      await recordAudit(admin, session, 'Saved attendance register', `Register ${parsed.date}`, `${records.length} pupils marked`);
    }

    return NextResponse.json({
      success: true,
      message: `Attendance register for ${parsed.date} saved successfully.`,
      count: records.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const pupilId = searchParams.get('pupil_id');

  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    let query = supabase.from('attendance').select('*').order('date', { ascending: false });

    if (date) query = query.eq('date', date);
    if (pupilId) query = query.eq('pupil_id', pupilId);

    const { data, error } = await query.limit(500);
    if (error) {
      console.error('[Attendance API] read failed:', error.message);
      return NextResponse.json({ records: [], warning: 'Attendance unavailable.' });
    }
    return NextResponse.json({ records: data || [] });
  } catch {
    return NextResponse.json({ records: [], warning: 'Database not connected.' });
  }
}
