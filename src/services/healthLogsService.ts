/** Health / nutrition logs via /api/health-logs. */

export interface HealthLogRow {
  id: string;
  pupil_id: string;
  weight_kg?: string | null;
  height_cm?: string | null;
  recorded_at: string;
  recorded_by?: string | null;
}

export async function fetchHealthLogs() {
  try {
    const res = await fetch('/api/health-logs', { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, logs: (data.logs || []) as HealthLogRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, logs: [] as HealthLogRow[], warning: 'Network error' };
  }
}

export async function saveHealthLog(pupilId: string, weightKg: string, heightCm: string) {
  try {
    const res = await fetch('/api/health-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, weight_kg: weightKg, height_cm: heightCm }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
