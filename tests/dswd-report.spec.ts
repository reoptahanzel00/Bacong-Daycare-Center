import { test, expect } from '@playwright/test';

test.describe('DSWD Form 1 PDF Report Export', () => {
  test('should open DSWD report modal and display demographic totals', async ({ page }) => {
    await page.goto('/');

    // Click DSWD PDF Report button
    await page.getByRole('button', { name: /dswd pdf report/i }).first().click();

    // Verify modal overlay opens with DSWD official header
    await expect(page.getByText('DSWD-Compliant Official Summary Report')).toBeVisible();
    await expect(page.getByText('BARANGAY BACONG DAYCARE CENTER')).toBeVisible();

    // Check dual signatories
    await expect(page.getByText('TERESA CRUZ')).toBeVisible();
    await expect(page.getByText('HON. RAMON SANTOS')).toBeVisible();
  });
});
