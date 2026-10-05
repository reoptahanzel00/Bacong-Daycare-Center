import { test, expect, type Page } from '@playwright/test';

/**
 * Regressions from the 2026-10-05 final audit. Each one was a save that
 * either wiped real data or reported success for something that never
 * happened. Offline demo mode, with the API mocked where a server is needed.
 */

async function openEccdTool(page: Page) {
  const eccdToolTab = page.getByRole('button', { name: /109-item eccd tool/i }).first();
  await expect(async () => {
    await eccdToolTab.click();
    await expect(page.getByText('Official ECCD Evaluation Suite')).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30000 });
}

test.describe('Final audit regressions', () => {
  test('ECCD: a checklist that failed to load cannot be saved over the stored one', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('bacong_auth_role', 'worker'));

    let ratingsAvailable = false;
    await page.route('**/api/eccd**', async (route) => {
      const url = route.request().url();
      if (url.includes('/scores')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ scores: [], evaluations: [] }) });
      } else if (url.includes('/background') || url.includes('/report')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ background: null }) });
      } else if (!ratingsAvailable) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Ratings unavailable.' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ratings: [], comments: [] }) });
      }
    });

    await page.goto('/');
    await openEccdTool(page);

    // Saving would send all 109 items as "not present"; it must be paused.
    await expect(page.getByText(/could not be loaded, so saving is paused/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /save evaluation/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /loading…/i }).first()).toBeDisabled();

    ratingsAvailable = true;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('button', { name: /save evaluation/i }).first()).toBeEnabled();
  });

  test('accounts: a network failure keeps the form open and adds no made-up user', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('bacong_auth_role', 'worker'));
    await page.route('**/api/users/create', (route) => route.abort('failed'));

    await page.goto('/');
    const usersTab = page.getByRole('button', { name: /user accounts/i }).first();
    await expect(async () => {
      await usersTab.click();
      await expect(page.getByRole('button', { name: /provision user account/i })).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });

    await page.getByRole('button', { name: /provision user account/i }).click();
    await page.getByLabel(/full name/i).fill('Network Failure Test');
    await page.getByLabel(/email address/i).fill('network.failure@example.com');
    await page.getByLabel(/temporary password/i).fill('Abcdefg123');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/the account was NOT created/i)).toBeVisible();
    await expect(page.getByLabel(/full name/i)).toHaveValue('Network Failure Test');
    await expect(page.getByText('network.failure@example.com', { exact: true })).toHaveCount(0);
  });

  test('sign-in: a crafted ?error= message is never echoed onto the page', async ({ page }) => {
    await page.goto('/login?error=' + encodeURIComponent('Account locked. Call 09171234567 to unlock.'));
    await expect(page.getByText('Something went wrong. Please sign in again.')).toBeVisible();
    await expect(page.getByText(/09171234567/)).toHaveCount(0);
  });
});
