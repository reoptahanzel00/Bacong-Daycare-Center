import { test, expect } from '@playwright/test';
import { resolveEnrollmentStatus } from '../src/lib/enrollment';

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
