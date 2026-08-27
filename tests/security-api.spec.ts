import { test, expect } from '@playwright/test';

/**
 * The signup and login routes are rate limited per client IP. These tests
 * assert validation and authorization behaviour, which is orthogonal to that,
 * so each request presents its own X-Forwarded-For — the header the limiter
 * keys on. Without it the suite exhausts the shared budget and later runs (or
 * CI's automatic retries) see 429 instead of the status under test.
 */
let ipCounter = 0;
// Unique per run, not just per test. The limiter's buckets live in the dev
// server's memory, which Playwright reuses between local runs -- addresses that
// only varied within a run were already spent the second time round.
const IP_RUN_SEED = Math.floor(Math.random() * 250);
function freshIpHeaders(): Record<string, string> {
  ipCounter += 1;
  // 198.51.100.0/24 and 203.0.113.0/24 are both reserved for documentation.
  return { 'x-forwarded-for': `198.51.100.${(IP_RUN_SEED + ipCounter) % 250}` };
}

test.describe('API Security & Health Check Automated Tests', () => {
  test('GET /api/health should return 200 OK with healthy status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeTruthy();
    // The probe deliberately withholds environment and version details from
    // anonymous callers; assert they stay withheld.
    expect(body.environment).toBeUndefined();
    expect(body.version).toBeUndefined();
  });

  test('POST /api/auth/signup should reject a weak password with 400', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      headers: freshIpHeaders(),
      data: { fullName: 'Test Parent', email: 'weak@example.com', password: 'weak' },
    });
    expect(response.status()).toBe(400);
  });

  test('POST /api/auth/signup should reject self-assigned privileged roles with 403', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      headers: freshIpHeaders(),
      data: {
        role: 'barangay_admin',
        fullName: 'Sneaky Admin',
        email: 'sneaky@example.com',
        password: 'Str0ng!Pass',
      },
    });
    expect(response.status()).toBe(403);
  });

  test('POST /api/auth/signup for a parent without child profiles should be rejected with 400', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      headers: freshIpHeaders(),
      data: {
        role: 'parent',
        fullName: 'No Child Parent',
        email: 'nochild@example.com',
        password: 'Str0ng!Pass',
        phone: '0917-000-0000',
      },
    });
    expect(response.status()).toBe(400);
  });

  test('repeated sign-in attempts from one IP are rate limited with 429', async ({ request }) => {
    const headers = freshIpHeaders();
    const attempt = () =>
      request.post('/api/auth/login', {
        headers,
        data: { email: 'nobody@example.com', password: 'WrongPass1' },
      });

    // The login window allows 10 per IP; the 11th must be refused.
    let sawRateLimit = false;
    for (let i = 0; i < 12; i++) {
      const res = await attempt();
      if (res.status() === 429) {
        sawRateLimit = true;
        break;
      }
    }
    expect(sawRateLimit, 'expected a 429 once the per-IP login budget was spent').toBe(true);
  });

  test('signup without privacy consent is rejected', async ({ request }) => {
    // RA 10173: the client hides the submit button until consent is ticked,
    // but the API is the boundary that actually counts.
    const response = await request.post('/api/auth/signup', {
      headers: freshIpHeaders(),
      data: {
        role: 'parent',
        fullName: 'No Consent Parent',
        email: 'noconsent@example.com',
        password: 'Str0ng!Pass',
        phone: '0917-000-0000',
        children: [],
      },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).toMatch(/consent/i);
  });

  test('unauthenticated centre settings are rejected with 401', async ({ request }) => {
    expect((await request.get('/api/settings')).status()).toBe(401);
    const patch = await request.patch('/api/settings', {
      data: { center_name: 'Hijacked', daycare_worker_name: 'x', barangay_captain_name: 'y' },
    });
    expect(patch.status()).toBe(401);
  });

  test('the client error reporter accepts a report and never echoes it back', async ({ request }) => {
    const res = await request.post('/api/client-error', {
      headers: freshIpHeaders(),
      data: { message: 'boom', path: '/' },
    });
    expect([204, 429]).toContain(res.status());
    expect((await res.body()).length).toBe(0);
  });

  test('unauthenticated POST /api/pupils/verify should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/pupils/verify', {
      data: { pupil_id: 'PUP-2026-001', action: 'approve' },
    });
    expect(response.status()).toBe(401);
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

  test('unauthenticated GET /api/eccd should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/eccd');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated POST /api/eccd should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/eccd', {
      data: { pupil_id: 'PUP-2026-001', ratings: [] },
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/eccd/scores should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/eccd/scores');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated POST /api/eccd/scores should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/eccd/scores', {
      data: { pupil_id: 'PUP-2026-001', scores: [] },
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated GET /api/eccd/background should be rejected with 401', async ({ request }) => {
    const response = await request.get('/api/eccd/background?pupil_id=PUP-2026-001');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated POST /api/eccd/background should be rejected with 401', async ({ request }) => {
    const response = await request.post('/api/eccd/background', {
      data: { pupil_id: 'PUP-2026-001', child_background: 'Test note' },
    });
    expect(response.status()).toBe(401);
  });

  test('unauthenticated parent-notes / announcements / health-logs routes are rejected with 401', async ({ request }) => {
    const routes = [
      { method: 'get', url: '/api/parent-notes' },
      { method: 'post', url: '/api/parent-notes', data: { pupil_id: 'PUP-2026-001', date: '2026-08-12', reason: 'Illness', notes: 'Test' } },
      { method: 'get', url: '/api/announcements' },
      { method: 'post', url: '/api/announcements', data: { title: 'Test', body: 'Test' } },
      { method: 'get', url: '/api/health-logs' },
      { method: 'post', url: '/api/health-logs', data: { pupil_id: 'PUP-2026-001', weight_kg: '14', height_cm: '98' } },
    ];
    for (const r of routes) {
      const response = await request[r.method as 'get'](r.url, r.data ? { data: r.data } : undefined);
      expect(response.status(), `${r.method.toUpperCase()} ${r.url}`).toBe(401);
    }
  });
});
