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

/**
 * Enrollment age window from the ECCD form: 3 years 1 month to 5 years
 * (inclusive of a child's 5th birthday month, exclusive of 5 years 1 month).
 */
export const MIN_ENROLLMENT_AGE_MONTHS = 37;
export const MAX_ENROLLMENT_AGE_MONTHS = 60;
export const ENROLLMENT_AGE_LABEL = '3 years 1 month to 5 years';

/** Whole months between a `YYYY-MM-DD` birth date and a `YYYY-MM-DD` day. */
export function ageInMonths(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = onDate.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  return months;
}

/**
 * Null when the child is within the enrollment age window on `onDate`,
 * otherwise the message to show the parent. Pure so the form and the API
 * give the same answer.
 */
export function enrollmentAgeError(birthDate: string, onDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return 'Enter a valid birth date.';
  if (birthDate > onDate) return 'Birth date cannot be in the future.';
  const months = ageInMonths(birthDate, onDate);
  if (months < MIN_ENROLLMENT_AGE_MONTHS || months > MAX_ENROLLMENT_AGE_MONTHS) {
    const y = Math.floor(months / 12);
    const m = months % 12;
    return `The child is ${y} year${y === 1 ? '' : 's'} ${m} month${m === 1 ? '' : 's'} old. Enrollment is for children ${ENROLLMENT_AGE_LABEL}.`;
  }
  return null;
}

/** Standard reasons a worker returns an enrollment to the parent. */
export const RETURN_REASONS = [
  'Missing or unreadable birth certificate',
  `Child's age is not within ${ENROLLMENT_AGE_LABEL}`,
  'Incomplete or incorrect child information',
  'Incomplete or incorrect guardian information',
] as const;

/** "Last, First Middle" — the display form stored in full_name columns. */
export function formatFullName(last: string, first: string, middle?: string | null): string {
  const given = [first.trim(), (middle || '').trim()].filter(Boolean).join(' ');
  return given ? `${last.trim()}, ${given}` : last.trim();
}
