/**
 * ECCD Service — official DepEd checklist ratings (✓/–, 3 annual rounds),
 * item comments, per-domain raw/scaled scores and the filled Child's Record 2
 * (Word) via /api/eccd.
 */
import type { EccdRecord, EccdRound } from '@/lib/eccdRecord';

export type { EccdRound };

export interface EccdRatingRow {
  pupil_id: string;
  milestone_code: string;
  status_rating: string;
  evaluation_round: number;
}

export interface EccdCommentRow {
  pupil_id: string;
  milestone_code: string;
  comment: string;
}

export interface EccdEvaluationRow {
  pupil_id: string;
  evaluation_round: number;
  evaluated_on: string | null;
  standard_score: number | null;
}

export interface EccdScoreRow {
  pupil_id: string;
  domain_id: string;
  evaluation_round: number;
  raw_score: number;
  scaled_score?: number | null;
}

export interface ChildBackground {
  pupil_id: string;
  child_background?: string | null;
  family_environment?: string | null;
  stimulating_activities?: string | null;
  home_environment?: string | null;
  others?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

export async function fetchEccdRatings(round: EccdRound = 1) {
  try {
    const res = await fetch(`/api/eccd?round=${round}`, { cache: 'no-store' });
    const data = await res.json();
    return {
      ok: res.ok,
      ratings: (data.ratings || []) as EccdRatingRow[],
      comments: (data.comments || []) as EccdCommentRow[],
      warning: data.warning as string | undefined,
    };
  } catch {
    return { ok: false, ratings: [] as EccdRatingRow[], comments: [] as EccdCommentRow[], warning: 'Network error' };
  }
}

export async function saveEccdRatings(
  pupilId: string,
  round: EccdRound,
  ratings: Array<{ milestone_code: string; domain_id: string; present: boolean; comment?: string }>
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
    return {
      ok: res.ok,
      scores: (data.scores || []) as EccdScoreRow[],
      evaluations: (data.evaluations || []) as EccdEvaluationRow[],
      warning: data.warning as string | undefined,
    };
  } catch {
    return { ok: false, scores: [] as EccdScoreRow[], evaluations: [] as EccdEvaluationRow[], warning: 'Network error' };
  }
}

export async function saveEccdScores(
  pupilId: string,
  round: EccdRound,
  scores: Array<{ domain_id: string; raw_score: number; scaled_score?: number | null }>,
  standardScore: number | null = null
) {
  try {
    const res = await fetch('/api/eccd/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, round, scores, standard_score: standardScore }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function fetchChildBackground(pupilId: string) {
  try {
    const res = await fetch(`/api/eccd/background?pupil_id=${encodeURIComponent(pupilId)}`, { cache: 'no-store' });
    const data = await res.json();
    return {
      ok: res.ok,
      background: (data.background || null) as ChildBackground | null,
      warning: data.warning as string | undefined,
    };
  } catch {
    return { ok: false, background: null as ChildBackground | null, warning: 'Network error' };
  }
}

export async function saveChildBackground(
  pupilId: string,
  fields: Partial<Omit<ChildBackground, 'pupil_id' | 'updated_by' | 'updated_at'>>
) {
  try {
    const res = await fetch('/api/eccd/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, ...fields }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

/** The pupil's full Child's Record 2 (all three rounds), for the report preview. */
export async function fetchEccdRecord(pupilId: string) {
  try {
    const res = await fetch(`/api/eccd/report?format=json&pupil_id=${encodeURIComponent(pupilId)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) return { ok: false, record: null, error: (data.error as string) || 'Could not load the record.' };
    return { ok: true, record: data.record as EccdRecord, error: undefined };
  } catch {
    return { ok: false, record: null, error: 'Network error' };
  }
}

/** Downloads the centre's ECCD Child's Record 2 Word form, filled in for the pupil. */
export async function downloadEccdRecord(pupilId: string, fallbackName: string) {
  try {
    const res = await fetch(`/api/eccd/report?pupil_id=${encodeURIComponent(pupilId)}`, { cache: 'no-store' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: (data.error as string) || 'Could not generate the record.' };
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const fileName = encoded ? decodeURIComponent(encoded) : fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return { ok: true, error: undefined };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
