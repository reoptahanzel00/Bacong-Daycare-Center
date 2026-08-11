/**
 * Attendance Service — abstraction over the /api/attendance/bulk endpoint.
 */

export interface AttendanceRecord {
  pupil_id: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

/** Raw row shape returned by GET /api/attendance/bulk. */
export interface AttendanceRow extends AttendanceRecord {
  id?: string;
  date: string;
  recorded_by?: string | null;
  created_at?: string;
}

export async function saveBulkAttendance(date: string, records: AttendanceRecord[]) {
  try {
    const res = await fetch('/api/attendance/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function fetchAttendance(options?: { date?: string; pupil_id?: string }) {
  try {
    const params = new URLSearchParams();
    if (options?.date) params.set('date', options.date);
    if (options?.pupil_id) params.set('pupil_id', options.pupil_id);
    const res = await fetch(`/api/attendance/bulk?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, records: (data.records || []) as AttendanceRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, records: [] as AttendanceRow[], warning: 'Network error' };
  }
}
