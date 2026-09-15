import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import {
  ECCD_ROUNDS,
  type EccdRecord,
  type EccdRecordProfile,
  type EccdRecordRound,
  type EccdRound,
} from '@/lib/eccdRecord';

type AdminClient = ReturnType<typeof createAdminClient>;

const KNOWN_ITEM_IDS = new Set(ECCD_DOMAINS.flatMap((d) => d.items.map((i) => i.id)));

/**
 * Everything the Child's Record 2 prints for one pupil, across all three
 * rounds. Callers authorise first: this reads with the service role.
 * Returns null when the pupil does not exist.
 */
export async function loadEccdRecord(admin: AdminClient, pupilId: string): Promise<EccdRecord | null> {
  const [pupilRes, profileRes, ratingsRes, commentsRes, scoresRes, evaluationsRes, backgroundRes, settingsRes] =
    await Promise.all([
      admin.from('pupils').select('id, first_name, last_name, sex, birth_date, address').eq('id', pupilId).maybeSingle(),
      admin.from('sociodemographic_profiles').select('*').eq('pupil_id', pupilId).maybeSingle(),
      admin
        .from('progress_observations')
        .select('milestone_code, evaluation_round, status_rating')
        .eq('pupil_id', pupilId)
        .not('milestone_code', 'is', null),
      admin.from('eccd_item_comments').select('milestone_code, evaluation_round, comment').eq('pupil_id', pupilId),
      admin.from('eccd_scores').select('domain_id, evaluation_round, scaled_score').eq('pupil_id', pupilId),
      admin
        .from('eccd_evaluations')
        .select('evaluation_round, evaluated_on, examiner_id, standard_score')
        .eq('pupil_id', pupilId),
      admin.from('child_backgrounds').select('*').eq('pupil_id', pupilId).maybeSingle(),
      admin.from('center_settings').select('center_name').maybeSingle(),
    ]);

  if (pupilRes.error) throw new Error(pupilRes.error.message);
  const pupil = pupilRes.data;
  if (!pupil) return null;

  const evaluations = evaluationsRes.data || [];
  const examinerIds = [...new Set(evaluations.map((e) => e.examiner_id).filter((id): id is string => !!id))];
  const examinerNames = new Map<string, string>();
  if (examinerIds.length > 0) {
    const { data: users } = await admin.from('users').select('id, full_name').in('id', examinerIds);
    for (const u of users || []) examinerNames.set(u.id, u.full_name);
  }

  const scores = scoresRes.data || [];
  const rounds: EccdRecordRound[] = ECCD_ROUNDS.map((round: EccdRound) => {
    const evaluation = evaluations.find((e) => e.evaluation_round === round);
    const roundScores = scores.filter((s) => s.evaluation_round === round);
    const scaled: Record<string, number | null> = {};
    for (const s of roundScores) scaled[s.domain_id] = s.scaled_score ?? null;
    const comments: Record<string, string> = {};
    for (const c of commentsRes.data || []) {
      if (c.evaluation_round === round && KNOWN_ITEM_IDS.has(c.milestone_code)) comments[c.milestone_code] = c.comment;
    }
    return {
      round,
      graded: !!evaluation || roundScores.length > 0,
      testedOn: evaluation?.evaluated_on ?? null,
      examinerName: evaluation?.examiner_id ? examinerNames.get(evaluation.examiner_id) ?? null : null,
      standardScore: evaluation?.standard_score ?? null,
      present: (ratingsRes.data || [])
        .filter((r) => r.evaluation_round === round && r.status_rating === 'Present' && KNOWN_ITEM_IDS.has(r.milestone_code))
        .map((r) => r.milestone_code),
      comments,
      scaled,
    };
  });

  const p = profileRes.data;
  const profile: EccdRecordProfile | null = p
    ? {
        handedness: p.handedness ?? null,
        currentlyStudying: !!p.currently_studying,
        schoolName: p.school_name ?? '',
        barangay: p.barangay ?? '',
        municipality: p.municipality ?? '',
        province: p.province ?? '',
        region: p.region ?? '',
        fatherName: p.father_name ?? '',
        fatherAge: p.father_age ?? null,
        fatherOccupation: p.father_occupation ?? '',
        fatherEducation: p.father_education ?? '',
        motherName: p.mother_name ?? '',
        motherAge: p.mother_age ?? null,
        motherOccupation: p.mother_occupation ?? '',
        motherEducation: p.mother_education ?? '',
        siblingsCount: p.siblings_count ?? null,
        birthOrder: p.birth_order ?? '',
      }
    : null;

  const b = backgroundRes.data;
  return {
    pupil: {
      id: pupil.id,
      firstName: pupil.first_name,
      lastName: pupil.last_name,
      sex: pupil.sex,
      birthDate: pupil.birth_date,
      address: pupil.address ?? '',
    },
    profile,
    rounds,
    background: b
      ? {
          child_background: b.child_background ?? '',
          family_environment: b.family_environment ?? '',
          stimulating_activities: b.stimulating_activities ?? '',
          home_environment: b.home_environment ?? '',
          others: b.others ?? '',
        }
      : null,
    centerName: settingsRes.data?.center_name || 'Barangay Bacong Daycare Center',
  };
}
