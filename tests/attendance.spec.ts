import { test, expect } from '@playwright/test';

test.describe('Daily Attendance Register Workflow', () => {
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
