/** The Barangay Executive Dashboard's figures via /api/reports/summary (counts only). */

export interface DashboardSummary {
  enrollment: {
    enrolled: number;
    pending: number;
    archived: number;
    male: number;
    female: number;
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
  eccd: { round1: number; round2: number; round3: number };
}

export async function fetchDashboardSummary() {
  try {
    const res = await fetch('/api/reports/summary', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) return { ok: false, summary: null, error: (data.error as string) || 'Summary unavailable.' };
    return { ok: true, summary: data as DashboardSummary, error: undefined };
  } catch {
    return { ok: false, summary: null, error: 'Network error' };
  }
}
