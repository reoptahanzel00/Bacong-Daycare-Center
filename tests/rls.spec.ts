import { test, expect } from '@playwright/test';
import path from 'node:path';

/**
 * What the offline suite cannot prove.
 *
 * Every other spec runs in demo mode, where authenticated routes answer 401
 * before a policy is consulted — so they show that signed-out users are locked
 * out, and nothing about whether the policies themselves are right. These sign
 * in for real against staging and assert the boundaries that matter in a
 * records system holding children's data.
 *
 * If one of these ever fails, treat it as a data-privacy incident in waiting,
 * not a flaky test.
 */

const state = (role: string) => path.join(process.cwd(), 'playwright', '.auth', `${role}.json`);

test.describe('Parent scope', () => {
  test.use({ storageState: state('parent') });

  test('a parent sees only the child they are linked to', async ({ request }) => {
    const res = await request.get('/api/pupils?status=enrolled');
    expect(res.status()).toBe(200);
    const { pupils } = await res.json();

    // The seed links this parent to exactly one enrolled pupil while others
    // exist, so "only mine" is a real assertion rather than a tautology.
    expect(Array.isArray(pupils)).toBe(true);
    expect(pupils.length).toBe(1);
  });

  test('a parent cannot read the staff directory or the audit trail', async ({ request }) => {
    expect((await request.get('/api/users')).status()).toBe(403);
    expect((await request.get('/api/audit-log')).status()).toBe(403);
  });

  test('a parent cannot enrol or edit a pupil', async ({ request }) => {
    const res = await request.post('/api/pupils', {
      data: {
        firstName: 'Should', lastName: 'NotExist', birthDate: '2022-01-01', sex: 'Male',
        address: 'Nowhere', guardianName: 'X', relationship: 'Mother', guardianPhone: '0900',
      },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Official scope', () => {
  test.use({ storageState: state('official') });

  test('an official cannot read individual progress observations', async ({ request }) => {
    // schema.sql excludes officials from progress_observations deliberately:
    // developmental notes on a named child are not oversight material.
    const res = await request.get('/api/progress');
    const body = await res.json();
    expect(body.observations ?? []).toEqual([]);
  });

  test('an official cannot list system accounts', async ({ request }) => {
    expect((await request.get('/api/users')).status()).toBe(403);
  });

  test('an official cannot record attendance', async ({ request }) => {
    const res = await request.post('/api/attendance/bulk', {
      data: { date: '2026-08-28', records: [{ pupil_id: 'PUP-2026-001', status: 'present' }] },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Worker scope', () => {
  test.use({ storageState: state('worker') });

  test('a worker sees the full roster but cannot list accounts', async ({ request }) => {
    const pupilsRes = await request.get('/api/pupils?status=enrolled');
    const { pupils } = await pupilsRes.json();
    expect(pupils.length).toBeGreaterThan(1);

    expect((await request.get('/api/users')).status()).toBe(403);
  });

  test('editing a pending pupil does not approve it', async ({ request }) => {
    // The F-03 verification bypass, asserted end to end rather than against the
    // extracted helper.
    const listRes = await request.get('/api/pupils?status=pending');
    const { pupils } = await listRes.json();
    test.skip(!pupils?.length, 'no pending enrolment in the staging seed');

    const target = pupils[0];
    await request.post('/api/pupils', {
      data: {
        id: target.id,
        firstName: target.first_name,
        lastName: target.last_name,
        birthDate: target.birth_date,
        sex: target.sex,
        address: target.address ?? '',
        enrollmentStatus: 'enrolled',
        guardianName: target.guardian?.[0]?.full_name ?? 'Guardian',
        relationship: 'Mother',
        guardianPhone: target.guardian?.[0]?.phone ?? '0900',
      },
    });

    const after = await request.get('/api/pupils?status=pending');
    const { pupils: stillPending } = await after.json();
    expect(stillPending.some((p: { id: string }) => p.id === target.id)).toBe(true);
  });
});

test.describe('Admin scope', () => {
  test.use({ storageState: state('admin') });

  test('an admin can read the directory and the audit trail', async ({ request }) => {
    expect((await request.get('/api/users')).status()).toBe(200);
    expect((await request.get('/api/audit-log')).status()).toBe(200);
  });
});

test.describe('Disabled accounts', () => {
  test('a disabled account cannot sign in even with the right password', async ({ page }) => {
    const password = process.env.E2E_PASSWORD;
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('e2e-disabled@example.test');
    await page.getByLabel(/^password$/i).fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/disabled|invalid email or password/i)).toBeVisible();
  });
});
