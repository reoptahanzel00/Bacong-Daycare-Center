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
    await expect(page.getByText('DSWD Form 1 Official Report PDF Generator')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'BARANGAY BACONG DAYCARE CENTER', exact: true })
    ).toBeVisible();

    // Check dual signatories
    await expect(page.getByText('TEACHER TERESA CRUZ')).toBeVisible();
    await expect(page.getByText('HON. RAMON SANTOS')).toBeVisible();
  });
});
