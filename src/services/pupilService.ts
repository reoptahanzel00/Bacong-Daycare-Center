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

/** ECCD Form Section 1 sociodemographic profile (snake_case DB columns). */
export interface SociodemographicProfileRow {
  id?: string;
  pupil_id: string;
  handedness?: 'right' | 'left' | 'both' | 'not_yet_established' | null;
  currently_studying?: boolean;
  school_name?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
  region?: string | null;
  father_name?: string | null;
  father_age?: number | null;
  father_occupation?: string | null;
  father_education?: string | null;
  mother_name?: string | null;
  mother_age?: number | null;
  mother_occupation?: string | null;
  mother_education?: string | null;
  siblings_count?: number | null;
  birth_order?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Raw row shape returned by GET /api/pupils (snake_case DB columns). */
export interface PupilRow {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: 'Male' | 'Female';
  address?: string;
  enrollment_status: 'pending' | 'enrolled' | 'rejected' | 'archived';
  enrollment_date?: string;
  consecutive_absences?: number;
  avatar_url?: string | null;
  rejection_reason?: string | null;
  /** One-to-many join: the API returns an ARRAY of guardians per pupil. */
  guardian?: Array<{
    id?: string;
    full_name: string;
    relationship: string;
    phone?: string;
    is_primary_contact?: boolean;
    user_id?: string | null;
  }>;
  /** One-to-one join: ECCD Form Section 1 profile (may be null). */
  sociodemographic?: SociodemographicProfileRow | SociodemographicProfileRow[] | null;
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

export async function fetchPupils(
  status: 'pending' | 'enrolled' | 'rejected' | 'archived' | Array<'pending' | 'enrolled' | 'rejected' | 'archived'> = 'enrolled'
) {
  try {
    const statusParam = Array.isArray(status) ? status.join(',') : status;
    const res = await fetch(`/api/pupils?status=${statusParam}`, { cache: 'no-store' });
    const data = await res.json();
    return { ok: res.ok, pupils: (data.pupils || []) as PupilRow[], warning: data.warning as string | undefined };
  } catch {
    return { ok: false, pupils: [] as PupilRow[], warning: 'Network error' };
  }
}

export async function fetchPendingPupils() {
  return fetchPupils('pending');
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

export interface VerifyPupilResult {
  success?: boolean;
  pupil?: { id: string; enrollmentStatus: 'enrolled' | 'rejected'; rejectionReason: string | null };
  error?: unknown;
}

export async function verifyPupil(
  pupilId: string,
  action: 'approve' | 'reject',
  reason?: string
): Promise<VerifyPupilResult> {
  try {
    const res = await fetch('/api/pupils/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pupil_id: pupilId, action, reason: reason || null }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
