import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const EccdRoundSchema = z.coerce.number().int().min(1).max(3).default(1);

const SaveEccdSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  round: z.coerce.number().int().min(1).max(3).default(1),
  ratings: z.array(
    z.object({
      milestone_code: z.string().min(1, 'Milestone code is required'),
      domain_id: z.string().min(1, 'Domain ID is required'),
      present: z.boolean(),
    })
  ),
});

/**
 * GET — checklist ratings for a given evaluation round.
 * Only PRESENT (✓) items are stored; absence is implied by a missing row,
 * so the raw score per domain is simply the count of returned rows.
 * Parents see only their linked children; staff see all.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const round = EccdRoundSchema.parse(searchParams.get('round') || '1');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    let query = admin
      .from('progress_observations')
      .select('pupil_id, milestone_code, status_rating, evaluation_round')
      .not('milestone_code', 'is', null)
      .eq('evaluation_round', round);

    if (session.role === 'parent') {
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
 * POST — replaces a pupil's ✓/– checklist for the given round.
 * Delete + insert of milestone-code rows scoped to (pupil, round);
 * milestone-modal observations (milestone_code NULL) are untouched.
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
    const presentItems = parsed.ratings.filter((r) => r.present);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // 1. Remove previous checklist rows for this pupil + round.
    const { error: deleteError } = await admin
      .from('progress_observations')
      .delete()
      .eq('pupil_id', parsed.pupil_id)
      .eq('evaluation_round', parsed.round)
      .not('milestone_code', 'is', null);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // 2. Insert the present (✓) items for this round.
    if (presentItems.length > 0) {
      const rows = presentItems.map((r) => ({
        pupil_id: parsed.pupil_id,
        domain_id: r.domain_id,
        milestone_code: r.milestone_code,
        title: r.milestone_code,
        note: `ECCD checklist round ${parsed.round}`,
        status_rating: 'Present',
        evaluation_round: parsed.round,
        observation_date: new Date().toISOString().split('T')[0],
        recorded_by: session.userId,
      }));
      const { error: insertError } = await admin.from('progress_observations').insert(rows);
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, saved: presentItems.length, round: parsed.round });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
