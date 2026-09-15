import { test, expect, type Page } from '@playwright/test';

/**
 * Keyboard and screen-reader behaviour of the modals.
 *
 * The 2026-09-05 audit found that every modal was a plain <div> overlay: no
 * role, no aria-modal, no Escape handler and no focus trap. A keyboard user who
 * opened the enrolment form tabbed straight out of it into the page behind,
 * with no way back and no cue that a dialog was still open, and a screen reader
 * was never told a dialog had opened at all.
 *
 * src/hooks/useModalA11y.ts fixed that. This spec is what keeps it fixed --
 * none of this behaviour is visible in a screenshot, so it is exactly the kind
 * of thing that regresses silently when someone restructures a modal.
 */

/** Seeds the demo worker role so the app renders the portal instead of /login. */
async function asWorker(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('bacong_auth_role', 'worker');
  });
}

/** The element currently holding focus, as a short description for assertions. */
async function focusedDescription(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return 'none';
    const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || '';
    return `${el.tagName.toLowerCase()}${label ? `:${label}` : ''}`;
  });
}

const MODALS = [
  { name: 'Enrol pupil', opener: /enroll pupil/i },
  { name: 'DSWD report', opener: /dswd pdf report/i },
] as const;

test.describe('Modal accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await asWorker(page);
    await page.goto('/');
  });

  for (const { name, opener } of MODALS) {
    test(`${name}: exposes dialog semantics and a name`, async ({ page }) => {
      await page.getByRole('button', { name: opener }).first().click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 15000 });
      await expect(dialog).toHaveAttribute('aria-modal', 'true');

      // The dialog is named from its own heading, so a screen reader announces
      // what opened rather than a bare "dialog".
      const labelledBy = await dialog.getAttribute('aria-labelledby');
      expect(labelledBy, 'dialog should be named via aria-labelledby').toBeTruthy();
      await expect(page.locator(`#${labelledBy}`)).toBeVisible();
      expect((await page.locator(`#${labelledBy}`).textContent())?.trim()).not.toBe('');
    });

    test(`${name}: moves focus into the dialog on open`, async ({ page }) => {
      await page.getByRole('button', { name: opener }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      // Focus must be inside the dialog, not left behind on the opener.
      const focusInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      expect(focusInside, `focus should be inside the ${name} dialog`).toBe(true);
    });

    test(`${name}: Escape closes it`, async ({ page }) => {
      await page.getByRole('button', { name: opener }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
    });

    test(`${name}: returns focus to the control that opened it`, async ({ page }) => {
      const trigger = page.getByRole('button', { name: opener }).first();
      const triggerText = (await trigger.textContent())?.trim() ?? '';

      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();

      // A keyboard user should land back where they were, not at the top of
      // the page with their place in the roster lost.
      const focused = await focusedDescription(page);
      expect(focused).toContain(triggerText);
    });
  }

  test('Tab wraps inside the dialog instead of escaping to the page behind', async ({ page }) => {
    await page.getByRole('button', { name: /enroll pupil/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });

    // Walk forward well past the number of controls the form has. Without a
    // trap this lands somewhere in the page underneath long before the end.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      expect(inside, `focus left the dialog after ${i + 1} Tab presses`).toBe(true);
    }

    // And backwards, which is the direction a naive trap usually gets wrong.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return !!dialog && dialog.contains(document.activeElement);
      });
      expect(inside, `focus left the dialog after ${i + 1} Shift+Tab presses`).toBe(true);
    }
  });

  test('every icon-only close control has an accessible name', async ({ page }) => {
    await page.getByRole('button', { name: /enroll pupil/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15000 });

    // A close button that announces only "button" tells a screen-reader user
    // there is a control but not that it is the way out of the dialog.
    const unnamed = await dialog.evaluate((node) =>
      Array.from(node.querySelectorAll('button')).filter((button) => {
        const hasText = (button.textContent ?? '').trim().length > 0;
        const hasLabel = !!button.getAttribute('aria-label') || !!button.getAttribute('aria-labelledby');
        return !hasText && !hasLabel;
      }).length
    );
    expect(unnamed, 'every button in the dialog should have an accessible name').toBe(0);
  });
});
