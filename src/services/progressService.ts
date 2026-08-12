/**
 * Progress Service — abstraction over the /api/progress endpoint.
 */

export interface ProgressPayload {
  pupil_id: string;
  domain: 'Motor Skills' | 'Language & Communication' | 'Socio-Emotional' | 'Self-Help & Cognitive';
  title?: string;
  note: string;
  date: string;
  rating?: string;
  recordedBy?: string;
}

/** Client-shaped observation row returned by GET /api/progress. */
export interface ProgressRow {
  id: string;
  pupil_id: string;
  domain: string;
  title?: string;
  note?: string;
  date: string;
  rating?: string;
  recorded_by?: string | null;
  created_at?: string;
}

export async function fetchProgress(pupilId?: string) {
  try {
    const url = pupilId ? `/api/progress?pupil_id=${pupilId}` : '/api/progress';
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, observations: (data.observations || []) as ProgressRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, observations: [] as ProgressRow[], warning: 'Network error' };
  }
}

export async function recordObservation(payload: ProgressPayload) {
  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, error: err.error || `Server error ${res.status}` };
    }

    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
