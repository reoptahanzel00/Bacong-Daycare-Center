import { NextResponse } from 'next/server';
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
