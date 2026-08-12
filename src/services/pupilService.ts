/**
 * Pupil Service — abstraction layer between UI and the /api/pupils endpoint.
 * All components should call these functions instead of fetching directly.
 */

export interface PupilEnrollPayload {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: 'Male' | 'Female';
  address: string;
  enrollmentStatus?: 'enrolled' | 'archived';
  guardianName: string;
  relationship: 'Mother' | 'Father' | 'Grandmother' | 'Grandfather' | 'Legal Guardian';
  guardianPhone: string;
}

/** Raw row shape returned by GET /api/pupils (snake_case DB columns). */
export interface PupilRow {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: 'Male' | 'Female';
  address?: string;
  enrollment_status: 'enrolled' | 'archived';
  enrollment_date?: string;
  consecutive_absences?: number;
  avatar_url?: string | null;
  /** One-to-many join: the API returns an ARRAY of guardians per pupil. */
  guardian?: Array<{
    id?: string;
    full_name: string;
    relationship: string;
    phone?: string;
    is_primary_contact?: boolean;
    user_id?: string | null;
  }>;
}

/** Client-shaped pupil returned by POST /api/pupils (camelCase). */
export interface PupilEnrollResultPupil {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  address: string;
  enrollmentStatus: string;
  enrollmentDate: string;
  consecutiveAbsences: number;
  guardian?: {
    fullName: string;
    relationship: string;
    phone?: string;
    isPrimary?: boolean;
  };
}

export interface PupilEnrollResult {
  success?: boolean;
  pupil?: PupilEnrollResultPupil;
  error?: unknown;
}

export async function fetchPupils(status: 'enrolled' | 'archived' = 'enrolled') {
  try {
    const res = await fetch(`/api/pupils?status=${status}`, { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, pupils: (data.pupils || []) as PupilRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, pupils: [] as PupilRow[], warning: 'Network error' };
  }
}

export async function enrollPupil(payload: PupilEnrollPayload): Promise<PupilEnrollResult> {
  try {
    const res = await fetch('/api/pupils', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
