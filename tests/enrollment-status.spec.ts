import { test, expect } from '@playwright/test';
import { resolveEnrollmentStatus, enrollmentAgeError, ageInMonths, formatFullName } from '../src/lib/enrollment';

/**
 * Regression cover for the verification bypass: POST /api/pupils used to write
 * enrollment_status straight from the request body, so a worker editing a
 * parent-submitted pending record silently approved it — skipping
 * /api/pupils/verify along with the parent notification and the audit entry.
 *
 * These assert the rule directly rather than through the route, because the
 * E2E suite runs in offline demo mode where every authenticated route answers
 * 401 before any of this logic is reached.
 */
test.describe('Enrollment status is only changed by verification', () => {
  test('a pending record stays pending through a demographic edit', () => {
    expect(resolveEnrollmentStatus('pending', 'enrolled')).toBe('pending');
  });

  test('a pending record cannot be archived by an edit either', () => {
    expect(resolveEnrollmentStatus('pending', 'archived')).toBe('pending');
  });

  test('a rejected record stays rejected until it is re-verified', () => {
    expect(resolveEnrollmentStatus('rejected', 'enrolled')).toBe('rejected');
  });

  test('an enrolled pupil can still be archived', () => {
    expect(resolveEnrollmentStatus('enrolled', 'archived')).toBe('archived');
  });

  test('an archived pupil can be restored to enrolled', () => {
    expect(resolveEnrollmentStatus('archived', 'enrolled')).toBe('enrolled');
  });

  test('a new pupil takes the requested status', () => {
    expect(resolveEnrollmentStatus(null, 'enrolled')).toBe('enrolled');
    expect(resolveEnrollmentStatus(undefined, 'enrolled')).toBe('enrolled');
  });
});

/**
 * Enrollment age window from the ECCD form: 3 years 1 month to 5 years. The
 * sign-up form, the worker's enroll form, the signup API, the pupils API and
 * the resubmit API all call enrollmentAgeError, so these pin the one rule.
 */
test.describe('Enrollment age validation (3y 1m to 5y)', () => {
  const today = '2026-09-27';

  test('ages are counted in whole months', () => {
    expect(ageInMonths('2023-08-27', today)).toBe(37);
    expect(ageInMonths('2023-08-28', today)).toBe(36);
  });

  test('a child of exactly 3 years 1 month may enroll', () => {
    expect(enrollmentAgeError('2023-08-27', today)).toBeNull();
  });

  test('a child of 3 years 0 months is too young', () => {
    expect(enrollmentAgeError('2023-09-27', today)).toMatch(/3 years 1 month to 5 years/);
  });

  test('a child of 5 years 0 months may enroll', () => {
    expect(enrollmentAgeError('2021-09-27', today)).toBeNull();
  });

  test('a child of 5 years 1 month is too old', () => {
    expect(enrollmentAgeError('2021-08-27', today)).toMatch(/3 years 1 month to 5 years/);
  });

  test('a birth date in the future is refused', () => {
    expect(enrollmentAgeError('2026-10-01', today)).toMatch(/future/);
  });
});

test.describe('Guardian names are stored Last, First Middle', () => {
  test('formats with and without a middle name', () => {
    expect(formatFullName('Santos', 'Maria', 'Reyes')).toBe('Santos, Maria Reyes');
    expect(formatFullName('Santos', 'Maria', '')).toBe('Santos, Maria');
  });
});
