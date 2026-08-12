/**
 * ECCD Service — 109-item checklist ratings via /api/eccd.
 */

export type EccdRating = 'P' | 'O' | 'R';

export interface EccdRatingRow {
  pupil_id: string;
  milestone_code: string;
  status_rating: string;
}

export async function fetchEccdRatings() {
  try {
    const res = await fetch('/api/eccd', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, ratings: (data.ratings || []) as EccdRatingRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, ratings: [] as EccdRatingRow[], warning: 'Network error' };
  }
}

export async function saveEccdRatings(
  pupilId: string,
  ratings: Array<{ milestone_code: string; domain_id: string; rating: EccdRating }>
) {
  try {
    const res = await fetch('/api/eccd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, ratings }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
