import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession, authorizeRole } from '@/lib/auth';
import { todayLocalISO } from '@/lib/dates';
import { recordAudit } from '@/lib/audit';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';

/** Official item code -> its domain, e.g. 'GM-01' -> 'gross_motor'. */
const ITEM_DOMAIN = new Map(ECCD_DOMAINS.flatMap((d) => d.items.map((i) => [i.id, d.id] as const)));

const EccdRoundSchema = z.coerce.number().int().min(1).max(3).default(1);

const SaveEccdSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  round: z.coerce.number().int().min(1).max(3).default(1),
  ratings: z.array(
    z.object({
      milestone_code: z.string().min(1, 'Milestone code is required'),
      domain_id: z.string().min(1, 'Domain ID is required'),
      present: z.boolean(),
      // The form's Comments column, e.g. why the child could not show the skill.
      comment: z.string().trim().max(300, 'Comments are limited to 300 characters').optional(),
    })
  ),
});

/**
 * GET — checklist ratings for a given evaluation round.
 * Only PRESENT (✓) items are stored; absence is implied by a missing row,
 * so the raw score per domain is simply the count of returned rows.
 * The round's per-item comments come back alongside.
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

    let pupilFilter: string[] | null = null;
    if (session.role === 'parent') {
      const { data: guardians } = await admin
        .from('guardians')
        .select('pupil_id')
        .eq('user_id', session.userId);
      const pupilIds = (guardians || []).map((g) => g.pupil_id);
      if (pupilIds.length === 0) {
        return NextResponse.json({ ratings: [], comments: [] });
      }
      pupilFilter = pupilIds;
    }

    // Read in pages. A worker loads every child's ticks for the round, and
    // ~10 fully assessed children already pass Supabase's 1000-row response
    // cap; a truncated load followed by a save used to erase the missing ticks.
    const [{ data, error }, { data: comments, error: commentsError }] = await Promise.all([
      fetchAllRows<{ pupil_id: string; milestone_code: string; status_rating: string; evaluation_round: number }>((from, to) => {
        let q = admin
          .from('progress_observations')
          .select('pupil_id, milestone_code, status_rating, evaluation_round')
          .not('milestone_code', 'is', null)
          .eq('evaluation_round', round);
        if (pupilFilter) q = q.in('pupil_id', pupilFilter);
        return q.order('id').range(from, to);
      }),
      fetchAllRows<{ pupil_id: string; milestone_code: string; comment: string }>((from, to) => {
        let q = admin
          .from('eccd_item_comments')
          .select('pupil_id, milestone_code, comment')
          .eq('evaluation_round', round);
        if (pupilFilter) q = q.in('pupil_id', pupilFilter);
        return q.order('pupil_id').order('milestone_code').range(from, to);
      }),
    ]);
    // A partial checklist must never look like a complete one: the client
    // treats a failed load as "do not allow saving", so fail the request.
    if (error || commentsError) {
      console.error('[ECCD API] ratings read failed:', (error || commentsError)?.message);
      return NextResponse.json({ error: 'Ratings unavailable.' }, { status: 503 });
    }
    return NextResponse.json({ ratings: data, comments });
  } catch {
    return NextResponse.json({ error: 'Ratings unavailable.' }, { status: 503 });
  }
}

/**
 * POST — replaces a pupil's ✓/– checklist and item comments for the given round.
 * Insert-then-delete of milestone-code rows scoped to (pupil, round), so a
 * failure part-way never leaves the round empty; milestone-modal observations
 * (milestone_code NULL) are untouched.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session.isAuthenticated || !session.userId) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!authorizeRole(session.role, ['worker'])) {
      return NextResponse.json(
        { error: 'Unauthorized: Only Daycare Workers can save evaluations.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = SaveEccdSchema.parse(body);

    // The checklist is fixed (109 official items), so the server decides which
    // domain an item belongs to and rejects anything that is not on it, rather
    // than trusting the client's domain_id into a foreign key mid-save.
    const unknown = parsed.ratings.find((r) => !ITEM_DOMAIN.has(r.milestone_code));
    if (unknown) {
      return NextResponse.json({ error: `Unknown checklist item ${unknown.milestone_code}.` }, { status: 400 });
    }
    const byCode = new Map(parsed.ratings.map((r) => [r.milestone_code, r]));
    const ratings = [...byCode.values()];
    const presentItems = ratings.filter((r) => r.present);

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    // Replace the round's checklist WITHOUT a window where it is empty:
    // remember the existing rows, insert the new ones, and only then delete
    // the old ones by id. If the insert fails nothing has been removed; if the
    // delete fails the next save removes the leftovers.
    const { data: previous, error: previousError } = await fetchAllRows<{ id: string }>((from, to) =>
      admin
        .from('progress_observations')
        .select('id')
        .eq('pupil_id', parsed.pupil_id)
        .eq('evaluation_round', parsed.round)
        .not('milestone_code', 'is', null)
        .order('id')
        .range(from, to)
    );
    if (previousError) {
      console.error('[ECCD API] read before save failed:', previousError.message);
      return NextResponse.json({ error: 'Could not save the checklist. Nothing was changed.' }, { status: 503 });
    }

    if (presentItems.length > 0) {
      const today = todayLocalISO();
      const rows = presentItems.map((r) => ({
        pupil_id: parsed.pupil_id,
        domain_id: ITEM_DOMAIN.get(r.milestone_code)!,
        milestone_code: r.milestone_code,
        title: r.milestone_code,
        note: `ECCD checklist round ${parsed.round}`,
        status_rating: 'Present',
        evaluation_round: parsed.round,
        observation_date: today,
        recorded_by: session.userId,
      }));
      const { error: insertError } = await admin.from('progress_observations').insert(rows);
      if (insertError) {
        console.error('[ECCD API] insert failed:', insertError.message);
        return NextResponse.json({ error: 'Could not save the checklist. Nothing was changed.' }, { status: 400 });
      }
    }

    const previousIds = previous.map((r) => r.id);
    for (let i = 0; i < previousIds.length; i += 200) {
      const { error: deleteError } = await admin
        .from('progress_observations')
        .delete()
        .in('id', previousIds.slice(i, i + 200));
      if (deleteError) {
        console.error('[ECCD API] removing previous ratings failed:', deleteError.message);
        return NextResponse.json(
          { error: 'The checklist was saved but older ticks could not be cleared. Please save again.' },
          { status: 500 }
        );
      }
    }

    // Comments: upsert on (pupil, round, item), then drop the ones cleared.
    const commentRows = ratings
      .filter((r) => r.comment)
      .map((r) => ({
        pupil_id: parsed.pupil_id,
        evaluation_round: parsed.round,
        milestone_code: r.milestone_code,
        comment: r.comment,
        updated_by: session.userId,
      }));
    if (commentRows.length > 0) {
      const { error: commentError } = await admin
        .from('eccd_item_comments')
        .upsert(commentRows, { onConflict: 'pupil_id,evaluation_round,milestone_code' });
      if (commentError) {
        console.error('[ECCD API] comment save failed:', commentError.message);
        return NextResponse.json(
          { error: 'The checklist was saved but its comments were not. Please save again.' },
          { status: 500 }
        );
      }
    }
    let clearQuery = admin
      .from('eccd_item_comments')
      .delete()
      .eq('pupil_id', parsed.pupil_id)
      .eq('evaluation_round', parsed.round);
    if (commentRows.length > 0) {
      // Codes were validated against the fixed checklist above, so they are
      // safe to place in the filter list.
      clearQuery = clearQuery.not(
        'milestone_code',
        'in',
        `(${commentRows.map((c) => `"${c.milestone_code}"`).join(',')})`
      );
    }
    const { error: commentClearError } = await clearQuery;
    if (commentClearError) {
      console.error('[ECCD API] clearing removed comments failed:', commentClearError.message);
    }

    await recordAudit(admin, session, 'Saved ECCD checklist', parsed.pupil_id, `Round ${parsed.round}: ${presentItems.length} items present, ${commentRows.length} comments`);

    return NextResponse.json({ success: true, saved: presentItems.length, round: parsed.round });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
