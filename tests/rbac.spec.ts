import { test, expect, type Page } from '@playwright/test';

/**
 * Seeds the demo auth role in localStorage before the app mounts. The app's
 * auth layer redirects unauthenticated visitors to /login, so UI tests must
 * establish a role this way to render each portal.
 */
async function seedRole(page: Page, role: string) {
  await page.addInitScript((storedRole) => {
    localStorage.setItem('bacong_auth_role', storedRole);
  }, role);
}

test.describe('Role-Based Access Control (RBAC) & Scope Isolation', () => {
  test('unauthenticated visitors are redirected to the login page', async ({ page }) => {
    await page.goto('/');
    // The redirect runs client-side in demo mode; allow headroom under
    // parallel dev-server load.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.getByText('Sign In to Your Account')).toBeVisible();
  });

  test('should render the Daycare Worker portal for the worker role', async ({ page }) => {
    await seedRole(page, 'worker');
    await page.goto('/');
    await expect(page.getByText(/daily register/i).first()).toBeVisible();
  });

  test('should render the Barangay Official portal for the official role', async ({ page }) => {
    await seedRole(page, 'official');
    await page.goto('/');
    await expect(page.getByText('Barangay Executive Dashboard')).toBeVisible();
    // Summaries only: officials get no DSWD roster and no child-record tabs.
    await expect(page.getByRole('button', { name: /dswd/i })).toHaveCount(0);
  });

  test('the paper has three roles: the Daycare Worker manages accounts and the audit trail', async ({ page }) => {
    await seedRole(page, 'worker');
    await page.goto('/');
    const accounts = page.getByRole('button', { name: 'User Accounts' }).first();
    await expect(async () => {
      await accounts.click();
      await expect(page.getByText('User Accounts & Audit Trail')).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Audit Trail' }).first()).toBeVisible();
  });

  test('a stale barangay_admin role falls back to the worker portal', async ({ page }) => {
    await seedRole(page, 'barangay_admin');
    await page.goto('/');
    await expect(page.getByText(/daily register/i).first()).toBeVisible();
  });

  test('should render the Parent portal for the parent role and hide admin controls', async ({ page }) => {
    await seedRole(page, 'parent');
    await page.goto('/');
    await expect(page.getByText('Parent Portal').first()).toBeVisible();
    await expect(page.getByText('Provision User Account')).not.toBeVisible();
  });
});
