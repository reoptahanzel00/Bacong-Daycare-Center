import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const HealthLogSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  weight_kg: z.string().max(10).optional(),
  height_cm: z.string().max(10).optional(),
  recorded_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** GET — parents see linked children; staff see all. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    let query = admin.from('health_logs').select('*').order('recorded_at', { ascending: false });
    if (session.role === 'parent') {
      const { data: guardians } = await admin
        .from('guardians')
        .select('pupil_id')
        .eq('user_id', session.userId);
      const pupilIds = (guardians || []).map((g) => g.pupil_id);
      if (pupilIds.length === 0) {
        return NextResponse.json({ logs: [] });
      }
      query = query.in('pupil_id', pupilIds);
    }

    const { data, error } = await query.limit(500);
    if (error) {
      return NextResponse.json({ logs: [], warning: error.message });
    }
    return NextResponse.json({ logs: data || [] });
  } catch {
    return NextResponse.json({ logs: [], warning: 'Health logs unavailable.' });
  }
}

/** POST — upsert today's weight/height for a pupil (worker/admin). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Admins can record health logs.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = HealthLogSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const recordedAt = parsed.recorded_at || new Date().toISOString().split('T')[0];

    const { error } = await admin.from('health_logs').upsert(
      {
        pupil_id: parsed.pupil_id,
        weight_kg: parsed.weight_kg || null,
        height_cm: parsed.height_cm || null,
        recorded_at: recordedAt,
        recorded_by: session.userId,
      },
      { onConflict: 'pupil_id,recorded_at' }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, pupil_id: parsed.pupil_id, recorded_at: recordedAt });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
