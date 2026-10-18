/**
 * Sign-in (#2): a member signs in with their mobile number and the code sent to it, and lands
 * on Tonight. Each test uses its own seeded member, because Auth sends one code a minute to a
 * number (a rerun inside that minute is refused as too many requests).
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';

// Locally every seeded number takes 123456 (supabase/config.template.toml); staging's code is private.
const CODE = isRemoteTarget() ? process.env.E2E_SIGN_IN_CODE : '123456';

async function requestCode(page: Page, number: string) {
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}/sign-in`);
  await expect(page.getByText('Skill runs deep.')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
}

test.describe('Sign-in', () => {
  test.skip(CODE === undefined, 'E2E_SIGN_IN_CODE is not set for the staging run');

  test('a member signs in with the code sent to their number and lands on Tonight', async ({ page }) => {
    await requestCode(page, '90000 00202');
    await page.getByRole('textbox', { name: 'Code sent to +91 90000 00202' }).fill(CODE ?? '');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  });

  test('a wrong code is refused, and says what to do', async ({ page }) => {
    await requestCode(page, '9000000203');
    await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Code sent to +91 90000 00203' }).fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText('Code wrong or expired. Check it, or request a new one.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send again in \d+ s/ })).toBeDisabled();
  });

  test('Change number goes back to the number', async ({ page }) => {
    await requestCode(page, '9000000204');
    await page.getByRole('button', { name: 'Change number' }).click();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
  });
});
