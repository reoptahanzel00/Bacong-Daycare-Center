import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Signs in once per role and saves the session, so the RLS specs can run as a
 * real user instead of asserting against 401s.
 *
 * Runs only in the `authenticated` project, which is skipped unless staging
 * credentials are present.
 */

const STATE_DIR = path.join(process.cwd(), 'playwright', '.auth');

const ROLES = [
  { role: 'worker',   email: 'e2e-worker@example.test' },
  { role: 'official', email: 'e2e-official@example.test' },
  { role: 'admin',    email: 'e2e-admin@example.test' },
  { role: 'parent',   email: 'e2e-parent@example.test' },
] as const;

for (const { role, email } of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const password = process.env.E2E_PASSWORD;
    expect(password, 'E2E_PASSWORD must be set for authenticated tests').toBeTruthy();

    await page.goto('/login');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();

    // The app routes to the role's portal once the server profile resolves.
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    fs.mkdirSync(STATE_DIR, { recursive: true });
    await page.context().storageState({ path: path.join(STATE_DIR, `${role}.json`) });
  });
}
