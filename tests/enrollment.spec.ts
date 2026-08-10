import { test, expect } from '@playwright/test';

test.describe('Pupil Enrollment Workflow', () => {
  test('should display enrolled pupils and open enrollment modal', async ({ page }) => {
    await page.goto('/');

    // Check daycare branding title
    await expect(page.locator('h2')).toContainText('Barangay Bacong Daycare Center');

    // Click Enroll Pupil button
    const enrollBtn = page.getByRole('button', { name: /enroll pupil/i }).first();
    await expect(enrollBtn).toBeVisible();
    await enrollBtn.click();

    // Verify modal overlay opens
    await expect(page.getByText('Enroll New Daycare Pupil')).toBeVisible();

    // Fill in pupil details
    await page.getByPlaceholder('e.g. Mateo').fill('Juanito');
    await page.getByPlaceholder('e.g. Santos').fill('Dela Rosa');
    await page.getByPlaceholder('e.g. Maria Santos').fill('Rosa Dela Rosa');

    // Submit form
    await page.getByRole('button', { name: /enroll pupil/i }).last().click();

    // Confirm modal closes
    await expect(page.getByText('Enroll New Daycare Pupil')).not.toBeVisible();
  });
});
