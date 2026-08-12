import { test, expect } from '@playwright/test';

test.describe('API Security & Health Check Automated Tests', () => {
  test('GET /api/health should return 200 OK with healthy status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toContain('Bacong Daycare');
  });

  test('POST /api/auth/signup should reject a weak password with 400', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: { fullName: 'Test Parent', email: 'weak@example.com', password: 'weak' },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/auth/signup should reject self-assigned privileged roles with 403', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {
        role: 'barangay_admin',
        fullName: 'Sneaky Admin',
        email: 'sneaky@example.com',
        password: 'Str0ng!Pass',
      },
    });
    expect(response.status()).toBe(403);
  });

  test('unauthenticated POST /api/attendance/bulk should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/attendance/bulk', {
      data: { invalidField: true }
    });
    // Auth is enforced before payload validation: no session => 401
    expect(response.status()).toBe(401);
  });

  test('unauthenticated POST /api/pupils should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/pupils', {
      data: { firstName: '' } // empty string fails min(1) constraint
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/pupils should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/pupils?status=enrolled');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/attendance/bulk should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/attendance/bulk?date=2026-08-11');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/notifications should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/notifications');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/progress should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/progress?pupil_id=PUP-1');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated POST /api/progress should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/progress', {
      data: { pupil_id: 'PUP-1' }
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated POST /api/users/create should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/users/create', {
      data: { fullName: 'Test', email: 'test@test.com', role: 'barangay_admin', password: 'Str0ng!Pass' }
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/audit-log should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/audit-log');
    expect(response.status()).toBe(401);
  });
});
