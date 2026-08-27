import { test, expect } from '@playwright/test';

test.describe('DSWD Form 1 PDF Report Export', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the demo auth role so the app renders the worker portal instead of
    // redirecting unauthenticated visitors to /login.
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'worker');
    });
  });

  test('should open DSWD report modal and display demographic totals', async ({ page }) => {
    await page.goto('/');

    // Click DSWD PDF Report button
    await page.getByRole('button', { name: /dswd pdf report/i }).first().click();

    // Verify modal overlay opens with the DSWD official report header
    await expect(page.getByText('DSWD Form 1 Official Report PDF Generator')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'BARANGAY BACONG DAYCARE CENTER', exact: true })
    ).toBeVisible();

    // Check dual signatories
    // Signatories come from centre settings and the signed-in user, not from
    // names baked into the component. In offline demo mode neither is set, so
    // the form says so rather than inventing an official.
    await expect(page.getByText(/prepared & certified by/i)).toBeVisible();
    await expect(page.getByText(/approved & noted by/i)).toBeVisible();
    await expect(page.getByText('Not recorded').first()).toBeVisible();
  });
});
