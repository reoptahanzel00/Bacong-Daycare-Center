import { test, expect, type Page } from '@playwright/test';

/**
 * What the sign-in box does with what people actually type into it.
 *
 * A parent reported "To reset your password, enter your email address instead
 * of the Student ID" for an email that looked complete on screen. The form
 * tested the raw text for a literal '@', so a full-width '＠' from a phone
 * keyboard, an address pasted out of Messenger with invisible characters
 * around it, or a value the browser autofilled without telling React all read
 * as "not an email". These pin each of those down.
 */

const IDENTIFIER = 'Email or Student ID';
const STUDENT_ID_MESSAGE = /instead of the Student ID/i;

async function openSignIn(page: Page) {
  await page.goto('/login');
  await expect(page.getByLabel(IDENTIFIER)).toBeVisible({ timeout: 15000 });
}

/** Records the body of every sign-in request without letting it reach the server. */
async function captureLogins(page: Page) {
  const bodies: Array<{ identifier?: string }> = [];
  await page.route('**/api/auth/login', async (route) => {
    bodies.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Invalid email, Student ID or password. Please check your credentials.' }),
    });
  });
  return bodies;
}

test.describe('Sign-in identifier', () => {
  test('a full-width ＠ email is treated as an email for password reset', async ({ page }) => {
    await openSignIn(page);
    await page.getByLabel(IDENTIFIER).fill('juan.delacruz＠gmail.com');
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page.getByText(STUDENT_ID_MESSAGE)).toHaveCount(0);
    // The field shows the cleaned address, so the user can see what is used.
    await expect(page.getByLabel(IDENTIFIER)).toHaveValue('juan.delacruz@gmail.com');
  });

  test('an autofilled email that never fired an input event is still read', async ({ page }) => {
    await openSignIn(page);
    // Browser autofill can put text in the box without a React change event.
    await page.getByLabel(IDENTIFIER).evaluate((el: HTMLInputElement) => {
      el.value = 'juan.delacruz@gmail.com';
    });
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page.getByText(STUDENT_ID_MESSAGE)).toHaveCount(0);
    await expect(page.getByText(/enter your email address first/i)).toHaveCount(0);
  });

  test('an incomplete email is called incomplete, not a Student ID', async ({ page }) => {
    await openSignIn(page);
    await page.getByLabel(IDENTIFIER).fill('juan.delacruzgmail.com');
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page.getByText(/looks incomplete/i)).toBeVisible();
    await expect(page.getByText(STUDENT_ID_MESSAGE)).toHaveCount(0);
  });

  test('a real Student ID still gets the Student ID reset message', async ({ page }) => {
    await openSignIn(page);
    await page.getByLabel(IDENTIFIER).fill('PUP-2026-47424A02');
    await page.getByRole('button', { name: /forgot password/i }).click();
    await expect(page.getByText(STUDENT_ID_MESSAGE)).toBeVisible();
  });

  test('a pasted email with invisible characters signs in as the clean address', async ({ page }) => {
    await openSignIn(page);
    const bodies = await captureLogins(page);
    // Zero-width space and bidi isolates, as copied out of chat apps, plus a
    // trailing space and capitals.
    await page.getByLabel(IDENTIFIER).fill('⁨Juan.DelaCruz@Gmail.com​⁩ ');
    await page.getByLabel('Password', { exact: true }).fill('Whatever123');
    await page.getByRole('button', { name: /sign in to portal/i }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].identifier).toBe('juan.delacruz@gmail.com');
  });

  test('an autofilled email is the one sent on sign-in', async ({ page }) => {
    await openSignIn(page);
    const bodies = await captureLogins(page);
    await page.getByLabel(IDENTIFIER).evaluate((el: HTMLInputElement) => {
      el.value = 'juan.delacruz@gmail.com';
    });
    await page.getByLabel('Password', { exact: true }).evaluate((el: HTMLInputElement) => {
      el.value = 'Whatever123';
    });
    await page.getByRole('button', { name: /sign in to portal/i }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].identifier).toBe('juan.delacruz@gmail.com');
  });

  test('text that is neither an email nor a Student ID is explained before sending', async ({ page }) => {
    await openSignIn(page);
    const bodies = await captureLogins(page);
    await page.getByLabel(IDENTIFIER).fill('juan delacruz');
    await page.getByLabel('Password', { exact: true }).fill('Whatever123');
    await page.getByRole('button', { name: /sign in to portal/i }).click();
    await expect(page.getByText(/complete email address/i)).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  test('a Student ID is sent upper-cased', async ({ page }) => {
    await openSignIn(page);
    const bodies = await captureLogins(page);
    await page.getByLabel(IDENTIFIER).fill(' pup-2026-47424a02 ');
    await page.getByLabel('Password', { exact: true }).fill('Whatever123');
    await page.getByRole('button', { name: /sign in to portal/i }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].identifier).toBe('PUP-2026-47424A02');
  });
});
