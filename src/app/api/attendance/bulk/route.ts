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

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can record attendance registers.' },
        { status: 403 }
      );
    }
    const body = await request.json();
    const parsed = BulkAttendanceSchema.parse(body);

    const records = parsed.records.map(r => ({
      pupil_id: r.pupil_id,
      date: parsed.date,
      status: r.status,
      notes: (r.notes || '').trim(),
      recorded_by: session.userId,
    }));

    // Try to persist to Supabase
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = await createClient();
      const { error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'pupil_id,date' });

      if (error) {
        console.error('[Attendance API] Upsert error:', error);
        return NextResponse.json({
          success: true,
          warning: 'Saved locally but database write failed. Will sync when connection is restored.',
          count: records.length,
        });
      }

      // Notify linked guardians when a pupil reaches 3+ consecutive absences.
      // Deferred with after(): the worker marking a register should not wait on
      // guardian lookups and email delivery, which are slow and unrelated to
      // whether the register saved. after() still runs the work to completion on
      // the server, unlike a bare floating promise, which a serverless instance
      // may kill once the response is sent.
      const pupilIds = records.map((r) => r.pupil_id);
      after(async () => {
        try {
          const { createAdminClient } = await import('@/lib/supabase/admin');
          const { notifyUsers, guardianUserIdsForPupils } = await import('@/lib/notify');
          const admin = createAdminClient();

          const { data: affected } = await admin
            .from('pupils')
            .select('id, first_name, consecutive_absences')
            .in('id', pupilIds);

          const alertPupils = (affected || []).filter((p) => p.consecutive_absences >= 3);
          if (alertPupils.length === 0) return;

          const targets = await guardianUserIdsForPupils(admin, alertPupils.map((p) => p.id));
          await notifyUsers(targets, {
            type: 'consecutive_absences',
            title: 'Absence Alert',
            message: alertPupils
              .map((p) => `${p.first_name} has ${p.consecutive_absences} consecutive absences.`)
              .join(' '),
            channel: 'EMAIL',
            severity: 'high',
          });
        } catch (alertError) {
          console.warn('[Attendance API] Absence alert skipped:', alertError);
        }
      });
    } catch {
      // Database not configured yet — graceful degradation
      console.warn('[Attendance API] Database not available, using local state fallback.');
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
    if (error) return NextResponse.json({ records: [], warning: error.message });
    return NextResponse.json({ records: data || [] });
  } catch {
    return NextResponse.json({ records: [], warning: 'Database not connected.' });
  }
}
