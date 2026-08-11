import { test, expect } from '@playwright/test';

test.describe('Pupil Enrollment Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Seed the demo auth role so the app renders the worker portal instead of
    // redirecting unauthenticated visitors to /login.
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'worker');
    });
  });

  test('should display enrolled pupils and open enrollment modal', async ({ page }) => {
    await page.goto('/');

    // Check daycare branding title
    await expect(
      page.getByRole('heading', { name: 'Barangay Bacong Daycare Center' }).first()
    ).toBeVisible();

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
    await page.getByRole('button', { name: /save enrollment/i }).click();

    // Confirm modal closes
    await expect(page.getByText('Enroll New Daycare Pupil')).not.toBeVisible();
  });
});
