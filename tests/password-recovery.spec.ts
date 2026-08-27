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
