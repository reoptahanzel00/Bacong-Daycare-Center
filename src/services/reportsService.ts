/** The Barangay Executive Dashboard's figures via /api/reports/summary (counts only). */

export interface DashboardSummary {
  enrollment: {
    enrolled: number;
    pending: number;
    archived: number;
    male: number;
    female: number;
    specialNeeds: number;
    ageBrackets: Array<{ label: string; count: number }>;
  };
  attendance: {
    schoolYear: string | null;
    present: number;
    late: number;
    absent: number;
    rate: number | null;
    today: { date: string; present: number; late: number; absent: number };
  };
  absences: { threshold: number; frequent: number };
  /** Enrolled children graded in each round, and in any round. */
  eccd: { round1: number; round2: number; round3: number; anyRound: number };
}

/** @param schoolYear e.g. 'SY 2026-2027'; omitted = the current school year. */
export async function fetchDashboardSummary(schoolYear?: string) {
  try {
    const query = schoolYear ? `?schoolYear=${encodeURIComponent(schoolYear)}` : '';
    const res = await fetch(`/api/reports/summary${query}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) return { ok: false, summary: null, error: (data.error as string) || 'Summary unavailable.' };
    return { ok: true, summary: data as DashboardSummary, error: undefined };
  } catch {
    return { ok: false, summary: null, error: 'Network error' };
  }
}
