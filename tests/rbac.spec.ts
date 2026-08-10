import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control (RBAC) & Scope Isolation', () => {
  test('should allow role switching across Worker, Official, Admin, and Parent views', async ({ page }) => {
    await page.goto('/');

    // Switch to Barangay Official
    await page.getByRole('button', { name: /barangay official/i }).click();
    await expect(page.getByText('Barangay Executive Oversight Hub')).toBeVisible();

    // Switch to Barangay Admin
    await page.getByRole('button', { name: /barangay admin/i }).click();
    await expect(page.getByText('Barangay System Administration')).toBeVisible();

    // Switch to Parent / Guardian
    await page.getByRole('button', { name: /parent \/ guardian/i }).click();
    await expect(page.getByText('Welcome, Maria Santos!')).toBeVisible();

    // Verify parent cannot see admin user provisioning controls
    await expect(page.getByText('Provision New System Account')).not.toBeVisible();
  });
});
