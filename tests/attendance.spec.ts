import { test, expect } from '@playwright/test';

test.describe('Daily Attendance Register Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the demo auth role so the app renders the worker portal instead of
    // redirecting unauthenticated visitors to /login.
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'worker');
    });
  });

  test('should allow daycare worker to toggle attendance register status', async ({ page }) => {
    await page.goto('/');

    // Verify daily register summary is visible
    await expect(page.getByText(/daily register/i).first()).toBeVisible();

    // Find segmented control buttons
    const presentButtons = page.locator('.segmented-btn.present');
    await expect(presentButtons.first()).toBeVisible();

    // Toggle status to Late
    const lateButtons = page.locator('.segmented-btn.late');
    await lateButtons.first().click();

    // Click Save Today / Save Register
    const saveBtn = page.getByRole('button', { name: /save today/i }).first();
    await saveBtn.click();

    // Check toast notification feedback
    await expect(page.getByText(/saved/i)).toBeVisible();
  });
});
