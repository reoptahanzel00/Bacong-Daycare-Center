/**
 * Pupil Service — abstraction layer between UI and the /api/pupils endpoint.
 * All components should call these functions instead of fetching directly.
 */

export interface PupilEnrollPayload {
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

export async function fetchPupils(status: 'enrolled' | 'archived' = 'enrolled') {
  try {
    const res = await fetch(`/api/pupils?status=${status}`, { cache: 'no-store' });
    const data = await res.json();
    return data.pupils || [];
  } catch {
    return [];
  }
}

export async function enrollPupil(payload: PupilEnrollPayload) {
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
