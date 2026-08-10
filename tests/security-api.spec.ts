import { test, expect } from '@playwright/test';

test.describe('API Security & Health Check Automated Tests', () => {
  test('GET /api/health should return 200 OK with healthy status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toContain('Bacong Daycare');
  });

  test('POST /api/attendance/bulk should enforce valid payload structure', async ({ request }) => {
    const response = await request.post('/api/attendance/bulk', {
      data: { invalidField: true }
    });
    // Should reject invalid Zod schema with 400 Bad Request
    expect(response.status()).toBe(400);
  });

  test('POST /api/pupils should reject invalid enrollment data', async ({ request }) => {
    const response = await request.post('/api/pupils', {
      data: { firstName: '' } // empty string fails min(1) constraint
    });
    expect(response.status()).toBe(400);
  });
});
