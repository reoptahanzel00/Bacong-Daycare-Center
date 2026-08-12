import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const RATING_TO_STATUS: Record<string, string> = {
  P: 'Present',
  O: 'In_Progress',
  R: 'Not_Yet_Observed',
};

const SaveEccdSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  ratings: z.array(
    z.object({
      milestone_code: z.string().min(1, 'Milestone code is required'),
      domain_id: z.string().min(1, 'Domain ID is required'),
      rating: z.enum(['P', 'O', 'R']),
    })
  ),
});

/** GET — checklist ratings. Parents see only their linked children; staff see all. */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    let query = admin
      .from('progress_observations')
      .select('pupil_id, milestone_code, status_rating')
      .not('milestone_code', 'is', null);

    if (session.role === 'parent') {
      // Scope parents to guardianship-linked children only.
      const { data: guardians } = await admin
        .from('guardians')
        .select('pupil_id')
        .eq('user_id', session.userId);
      const pupilIds = (guardians || []).map((g) => g.pupil_id);
      if (pupilIds.length === 0) {
        return NextResponse.json({ ratings: [] });
      }
      query = query.in('pupil_id', pupilIds);
    }

    const { data, error } = await query.limit(5000);
    if (error) {
      return NextResponse.json({ ratings: [], warning: error.message });
    }
    return NextResponse.json({ ratings: data || [] });
  } catch {
    return NextResponse.json({ ratings: [], warning: 'Ratings unavailable.' });
  }
}

/**
 * POST — replaces the pupil's checklist ratings (milestone-code rows only,
 * so milestone modal observations are untouched). Worker/admin only.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Admins can save evaluations.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = SaveEccdSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // 1. Remove previous checklist rows for this pupil (milestone_code set).
    const { error: deleteError } = await admin
      .from('progress_observations')
      .delete()
      .eq('pupil_id', parsed.pupil_id)
      .not('milestone_code', 'is', null);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // 2. Insert the current ratings.
    if (parsed.ratings.length > 0) {
      const rows = parsed.ratings.map((r) => ({
        pupil_id: parsed.pupil_id,
        domain_id: r.domain_id,
        milestone_code: r.milestone_code,
        title: r.milestone_code,
        note: 'ECCD checklist evaluation',
        status_rating: RATING_TO_STATUS[r.rating],
        observation_date: new Date().toISOString().split('T')[0],
        recorded_by: session.userId,
      }));
      const { error: insertError } = await admin.from('progress_observations').insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, saved: parsed.ratings.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
