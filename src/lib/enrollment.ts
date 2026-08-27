/**
 * Enrollment status rules shared by the pupil write path.
 *
 * A parent-submitted enrollment starts as `pending` and may only leave that
 * state through /api/pupils/verify, which records the worker's decision, the
 * rejection reason, the parent notification and the audit entry. Editing a
 * pupil's demographics must never move it, or a spelling correction silently
 * becomes an approval with none of that trail.
 */

export type EnrollmentStatus = 'pending' | 'enrolled' | 'rejected' | 'archived';

/** Statuses that only the verification endpoint may transition away from. */
const AWAITING_VERIFICATION: EnrollmentStatus[] = ['pending', 'rejected'];

/**
 * Decides the status a demographic edit should persist.
 *
 * @param existing status already on the record, or null/undefined for a new pupil
 * @param requested status supplied by the caller
 */
export function resolveEnrollmentStatus(
  existing: string | null | undefined,
  requested: EnrollmentStatus
): EnrollmentStatus {
  if (existing && AWAITING_VERIFICATION.includes(existing as EnrollmentStatus)) {
    return existing as EnrollmentStatus;
  }
  return requested;
}
