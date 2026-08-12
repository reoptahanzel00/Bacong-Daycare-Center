import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';

const EccdRoundSchema = z.coerce.number().int().min(1).max(3).default(1);

const SaveScoresSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  round: z.coerce.number().int().min(1).max(3).default(1),
  scores: z.array(
    z.object({
      domain_id: z.string().min(1, 'Domain ID is required'),
      raw_score: z.number().int().min(0).max(200),
      scaled_score: z.number().int().min(0).max(100).nullable().optional(),
    })
  ),
});

/** GET — per-domain raw/scaled scores for a round. Parents scoped, staff all. */
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
      .from('eccd_scores')
      .select('pupil_id, domain_id, evaluation_round, raw_score, scaled_score')
      .eq('evaluation_round', round);

    if (session.role === 'parent') {
      const { data: guardians } = await admin
        .from('guardians')
        .select('pupil_id')
        .eq('user_id', session.userId);
      const pupilIds = (guardians || []).map((g) => g.pupil_id);
      if (pupilIds.length === 0) {
        return NextResponse.json({ scores: [] });
      }
      query = query.in('pupil_id', pupilIds);
    }

    const { data, error } = await query.limit(2000);
    if (error) {
      return NextResponse.json({ scores: [], warning: error.message });
    }
    return NextResponse.json({ scores: data || [] });
  } catch {
    return NextResponse.json({ scores: [], warning: 'Scores unavailable.' });
  }
}

/** POST — upsert raw/scaled scores per domain per round (worker/admin). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker', 'barangay_admin'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers or Admins can save scores.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = SaveScoresSchema.parse(body);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const rows = parsed.scores.map((s) => ({
      pupil_id: parsed.pupil_id,
      domain_id: s.domain_id,
      evaluation_round: parsed.round,
      raw_score: s.raw_score,
      scaled_score: s.scaled_score ?? null,
    }));

    const { error } = await admin
      .from('eccd_scores')
      .upsert(rows, { onConflict: 'pupil_id,domain_id,evaluation_round' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, saved: rows.length, round: parsed.round });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
