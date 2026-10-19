import { test, expect } from '@playwright/test';

/**
 * The password recovery flow. Before /auth/callback existed, the reset email's
 * link landed on a page that ignored its PKCE code, so "reset your password"
 * silently did nothing and a locked-out parent had no way back in.
 *
 * These run in offline demo mode, so the code exchange always fails — which is
 * exactly the expired-link path a real user is most likely to hit.
 */
test.describe('Password recovery', () => {
  test('the set-a-new-password page is reachable without a session', async ({ page }) => {
    const res = await page.goto('/reset-password');
    expect(res?.status()).toBe(200);
    // Without a recovery session it must explain itself rather than showing a
    // form that cannot work.
    await expect(page.getByText(/expired or was already used/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to sign in/i })).toBeVisible();
  });

  test('a link with no code returns the user to sign-in with a reason', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/missing its security code/i)).toBeVisible();
  });

  test('an expired or reused link explains itself on the sign-in page', async ({ page }) => {
    await page.goto('/auth/callback?code=expired-or-already-used&next=/reset-password');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/expired or was already used/i)).toBeVisible();
  });

  test('the callback refuses to forward to an external site', async ({ request }) => {
    // An open redirect here would turn a link we email into one that forwards
    // to somebody else's site with the recipient's trust already attached.
    const res = await request.get('/auth/callback?code=x&next=//evil.example.com', {
      maxRedirects: 0,
    });
    const location = res.headers()['location'] ?? '';
    expect(location).not.toContain('evil.example.com');
  });

  test('sign-in offers a way to request a reset', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/forgot/i).first()).toBeVisible();
  });
});

/**
 * The reset email has to work on whatever device opens it.
 *
 * "Forgot password?" used the PKCE flow, which ties the emailed link to a
 * verifier cookie in the browser that asked for it. A parent who asked on the
 * laptop and tapped the link in the Gmail app, or on their phone, always got
 * "That link has expired or was already used" (seen live 2026-10-19: Supabase
 * verified the link, and the code exchange never happened). The request now
 * uses the implicit flow, whose link carries the recovery session itself, and
 * /reset-password takes it from the URL fragment.
 *
 * In the test server the browser client points at a placeholder Supabase host,
 * so its requests can be caught here.
 */
test.describe('Password reset works on any device', () => {
  const SUPABASE = 'https://placeholder.supabase.co';

  /** An unsigned token in the shape supabase-js decodes; it never checks the signature. */
  function fakeAccessToken() {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
      sub: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'parent@example.test',
      iat: now,
      exp: now + 3600,
    })}.${Buffer.from('not-a-real-signature').toString('base64url')}`;
  }

  test('Forgot password asks for a link that carries its own session', async ({ page }) => {
    const recoverRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
    await page.route(`${SUPABASE}/auth/v1/recover**`, async (route) => {
      recoverRequests.push({ url: route.request().url(), body: JSON.parse(route.request().postData() || '{}') });
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/login');
    await page.getByLabel('Email or Student ID').fill('parent@example.test');
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page.getByText(/reset link sent/i)).toBeVisible();

    expect(recoverRequests).toHaveLength(1);
    // No PKCE challenge: the link must not depend on this browser's cookies.
    expect(recoverRequests[0].body.code_challenge ?? null).toBeNull();
    const redirectTo = new URL(recoverRequests[0].url).searchParams.get('redirect_to') ?? '';
    expect(new URL(redirectTo).pathname).toBe('/reset-password');
  });

  test('a link opened in a fresh browser shows the new-password form', async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/user**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000001',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'parent@example.test',
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        }),
      })
    );

    await page.goto(
      `/reset-password#access_token=${fakeAccessToken()}&refresh_token=fake-refresh&expires_in=3600&token_type=bearer&type=recovery`
    );
    await expect(page.getByRole('button', { name: /save new password/i })).toBeVisible({ timeout: 15000 });
    // The tokens are taken out of the address bar straight away.
    expect(page.url()).not.toContain('access_token');
  });

  test('an expired emailed link explains itself', async ({ page }) => {
    await page.goto(
      '/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );
    await expect(page.getByText(/expired or was already used/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to sign in/i })).toBeVisible();
  });
});
