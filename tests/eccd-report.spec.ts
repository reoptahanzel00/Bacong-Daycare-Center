import { test, expect, type Page } from '@playwright/test';

const RECORD = {
  pupil: {
    id: 'PUP-2026-001',
    firstName: 'Mateo',
    lastName: 'Santos',
    sex: 'Male',
    birthDate: '2022-05-20',
    address: 'Purok 3, Bacong',
  },
  profile: null,
  rounds: [
    {
      round: 1,
      graded: true,
      testedOn: '2026-09-10',
      examinerName: 'Teresa Cruz',
      standardScore: 95,
      present: ['GM-01'],
      comments: { 'GM-02': 'Needed support' },
      scaled: { gross_motor: 9 },
    },
    { round: 2, graded: false, testedOn: null, examinerName: null, standardScore: null, present: [], comments: {}, scaled: {} },
    { round: 3, graded: false, testedOn: null, examinerName: null, standardScore: null, present: [], comments: {}, scaled: {} },
  ],
  background: null,
  centerName: 'Barangay Bacong Daycare Center',
};

/**
 * Mocks the ECCD API so the report flow can be exercised without a live
 * Supabase session: GETs return fixed data, POSTs (save evaluation) succeed,
 * and the record route returns the preview JSON or a stand-in .docx body.
 */
async function mockEccdApi(page: Page) {
  await page.route('**/api/eccd**', async (route) => {
    const request = route.request();
    const url = request.url();
    const isScores = url.includes('/scores');
    if (url.includes('/report')) {
      if (url.includes('format=json')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ record: RECORD }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          headers: {
            'Content-Disposition': `attachment; filename="ECCD_Record2_Santos_Mateo.docx"; filename*=UTF-8''ECCD_Record2_Santos_Mateo.docx`,
          },
          body: 'PK',
        });
      }
    } else if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isScores ? { success: true, saved: 7, round: 1 } : { success: true, saved: 1, round: 1 }),
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
            { pupil_id: 'PUP-2026-001', domain_id: 'gross_motor', evaluation_round: 1, raw_score: 1, scaled_score: 9 },
          ],
          evaluations: [
            { pupil_id: 'PUP-2026-001', evaluation_round: 1, evaluated_on: '2026-09-10', standard_score: 95 },
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
          comments: [{ pupil_id: 'PUP-2026-001', milestone_code: 'GM-02', comment: 'Needed support' }],
        }),
      });
    }
  });
}

test.describe("ECCD Child's Record 2 (Word)", () => {
  test('worker: record auto-opens after save and the filled Word form can be downloaded', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'worker');
    });
    await mockEccdApi(page);

    await page.goto('/');

    // Open the ECCD evaluation tool. Auth hydration right after mount can
    // reset the active tab back to the dashboard, so keep clicking until the
    // ECCD suite is stably visible.
    const eccdToolTab = page.getByRole('button', { name: /109-item eccd tool/i }).first();
    await expect(async () => {
      await eccdToolTab.click();
      await expect(page.getByText('Official ECCD Evaluation Suite')).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });

    // The saved comment and standard score are loaded into the grading screen.
    await expect(page.getByRole('button', { name: /edit comment for item 2/i }).first()).toBeVisible();
    await expect(page.getByLabel('Standard Score (all domains):').first()).toHaveValue('95');

    // Add a comment to an item, then save -> record preview auto-opens.
    await page.getByRole('button', { name: /add comment for item 3/i }).first().click();
    await page.getByLabel(/comment for item 3:/i).first().fill('Afraid of falling');
    await page.getByRole('button', { name: /save evaluation/i }).first().click();
    await expect(
      page.getByRole('heading', { name: 'ECCD Pupil Evaluation Report' }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Mateo Santos (PUP-2026-001)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sociodemographic Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Computation of the Child's Age/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Gross Motor Domain \(13 items\)/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Social-Emotional Domain \(24 items\)/ })).toBeVisible();
    await expect(page.getByText('✓').first()).toBeVisible();
    await expect(page.getByText('1st: Needed support')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Average overall development', exact: true })).toBeVisible();

    // Close, then reopen via the per-pupil ECCD Record button.
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();
    await page.getByRole('button', { name: 'ECCD Record', exact: true }).first().click();
    await expect(
      page.getByRole('heading', { name: 'ECCD Pupil Evaluation Report' }).first()
    ).toBeVisible();

    // Download the filled Word form.
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: /download eccd record/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ECCD_Record2_Santos_Mateo\.docx$/);
  });

  test('worker: saving sends the comment and standard score', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('bacong_auth_role', 'worker');
    });
    await mockEccdApi(page);
    await page.goto('/');

    const eccdToolTab = page.getByRole('button', { name: /109-item eccd tool/i }).first();
    await expect(async () => {
      await eccdToolTab.click();
      await expect(page.getByText('Official ECCD Evaluation Suite')).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });

    await page.getByRole('button', { name: /add comment for item 3/i }).first().click();
    await page.getByLabel(/comment for item 3:/i).first().fill('Afraid of falling');
    await page.getByLabel('Standard Score (all domains):').first().fill('101');

    const ratingsPost = page.waitForRequest((r) => r.method() === 'POST' && /\/api\/eccd$/.test(new URL(r.url()).pathname));
    const scoresPost = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/eccd/scores'));
    await page.getByRole('button', { name: /save evaluation/i }).first().click();

    const ratingsBody = (await ratingsPost).postDataJSON();
    expect(ratingsBody.ratings).toHaveLength(109);
    expect(ratingsBody.ratings.find((r: { milestone_code: string }) => r.milestone_code === 'GM-03').comment).toBe('Afraid of falling');
    expect(ratingsBody.ratings.find((r: { milestone_code: string }) => r.milestone_code === 'GM-01').present).toBe(true);
    expect((await scoresPost).postDataJSON().standard_score).toBe(101);
  });

  test('parent: Download Report Card opens the linked child record with all three rounds', async ({ page }) => {
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
    await expect(page.getByRole('heading', { name: 'Sociodemographic Profile' })).toBeVisible();

    // All three evaluation columns are present in the checklist tables.
    await expect(page.getByText('1st Eval', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('2nd Eval', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('3rd Eval', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /download eccd record/i })).toBeEnabled();
  });
});
