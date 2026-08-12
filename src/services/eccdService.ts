/**
 * ECCD Service — official DepEd checklist ratings (✓/–, 3 annual rounds)
 * and per-domain raw/scaled scores via /api/eccd.
 */

export type EccdRound = 1 | 2 | 3;

export interface EccdRatingRow {
  pupil_id: string;
  milestone_code: string;
  status_rating: string;
  evaluation_round: number;
}

export interface EccdScoreRow {
  pupil_id: string;
  domain_id: string;
  evaluation_round: number;
  raw_score: number;
  scaled_score?: number | null;
}

export async function fetchEccdRatings(round: EccdRound = 1) {
  try {
    const res = await fetch(`/api/eccd?round=${round}`, { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, ratings: (data.ratings || []) as EccdRatingRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, ratings: [] as EccdRatingRow[], warning: 'Network error' };
  }
}

export async function saveEccdRatings(
  pupilId: string,
  round: EccdRound,
  ratings: Array<{ milestone_code: string; domain_id: string; present: boolean }>
) {
  try {
    const res = await fetch('/api/eccd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, round, ratings }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function fetchEccdScores(round: EccdRound = 1) {
  try {
    const res = await fetch(`/api/eccd/scores?round=${round}`, { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, scores: (data.scores || []) as EccdScoreRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, scores: [] as EccdScoreRow[], warning: 'Network error' };
  }
}

export async function saveEccdScores(
  pupilId: string,
  round: EccdRound,
  scores: Array<{ domain_id: string; raw_score: number; scaled_score?: number | null }>
) {
  try {
    const res = await fetch('/api/eccd/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, round, scores }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
