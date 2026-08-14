import { test, expect, type Page } from '@playwright/test';

/**
 * Mocks the ECCD API so the report flow can be exercised without a live
 * Supabase session: GETs return empty data, POSTs (save evaluation) succeed.
 */
async function mockEccdApi(page: Page) {
  await page.route('**/api/eccd**', async (route) => {
    const request = route.request();
    const url = request.url();
    const isScores = url.includes('/scores');
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isScores ? { success: true, saved: 5, round: 1 } : { success: true, saved: 1, round: 1 }),
      });
    } else if (url.includes('/background')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ background: null }),
      });
    } else if (isScores) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scores: [
            { pupil_id: 'PUP-2026-001', domain_id: 'gross_motor', evaluation_round: 1, raw_score: 3, scaled_score: 9 },
          ],
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ratings: [
            { pupil_id: 'PUP-2026-001', milestone_code: 'GM-01', status_rating: 'Present', evaluation_round: 1 },
          ],
        }),
      });
    }
  });
}

test.describe('ECCD Pupil Evaluation Report PDF', () => {
  test('worker: report auto-opens after save and PDF can be downloaded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'worker');
    });
    await mockEccdApi(page);

    await page.goto('/');

    // Open the ECCD evaluation tool. Auth hydration right after mount can
    // reset the active tab back to the dashboard, so keep clicking until the
    // ECCD suite is stably visible.
    const eccdToolTab = page.getByRole('button', { name: /104-item eccd tool/i }).first();
    await expect(async () => {
      await eccdToolTab.click();
      await expect(page.getByText('Official ECCD Evaluation Suite')).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });

    // Save the first pupil's evaluation -> report modal auto-opens.
    await page.getByRole('button', { name: /save evaluation/i }).first().click();
    await expect(
      page.getByRole('heading', { name: 'ECCD Pupil Evaluation Report' }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Mateo Santos (PUP-2026-001)')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Section 1: Sociodemographic Profile' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Section 2: Computation of the Child's Age/ })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Section 3: Gross Motor Domain/ })
    ).toBeVisible();
    await expect(page.getByText('✓').first()).toBeVisible();

    // Close, then reopen via the per-pupil Report PDF button.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: /report pdf/i }).first().click();
    await expect(
      page.getByRole('heading', { name: 'ECCD Pupil Evaluation Report' }).first()
    ).toBeVisible();

    // Download the PDF.
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: /download eccd report pdf/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ECCD_Record2_Santos_Mateo\.pdf$/);
  });

  test('parent: Download Report Card opens the linked child report with all three rounds', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'parent');
    });
    await mockEccdApi(page);

    await page.goto('/');

    await page.getByRole('button', { name: /download report card/i }).first().click();
    await expect(
      page.getByRole('heading', { name: 'ECCD Pupil Evaluation Report' }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Mateo Santos (PUP-2026-001)')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Section 1: Sociodemographic Profile' })
    ).toBeVisible();

    // All three evaluation columns are present in the checklist tables.
    await expect(page.getByText('1st Eval', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('2nd Eval', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('3rd Eval', { exact: true }).first()).toBeVisible();
  });
});
