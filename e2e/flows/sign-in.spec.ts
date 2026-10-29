/**
 * Sign-in (#2): a member signs in with their mobile number and the code sent to it, and lands
 * on Tonight; a member whose identity check is not done sees only the check (#632). Each test uses its own seeded member, because Auth sends one code a minute to a
 * number (a rerun inside that minute is refused as too many requests).
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';

// Locally every seeded number takes 123456 (supabase/config.template.toml); staging's code is
// private, in the e2e-staging environment (docs/runbooks/ci-and-release.md).
const CODE = isRemoteTarget() ? (process.env.E2E_SIGN_IN_CODE ?? '') : '123456';

async function requestCode(page: Page, number: string) {
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}/sign-in`);
  await expect(page.getByText('Skill runs deep.')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
}

test.describe('Sign-in', () => {
  test.beforeAll(() => {
    if (CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the sign-in flow cannot sign in on staging');
  });

  test('a member signs in with the code sent to their number and lands on Tonight', async ({ page }) => {
    await requestCode(page, '90000 00281');
    await page.getByRole('textbox', { name: 'Code sent to +91 90000 00281' }).fill(CODE);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    // Signed in, Back does not lead to the sign-in screen again.
    await page.goBack();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toHaveCount(0);
  });

  test('a member whose identity check is not done sees only the check (#632)', async ({ page }) => {
    await requestCode(page, '90000 00202');
    await page.getByRole('textbox', { name: 'Code sent to +91 90000 00202' }).fill(CODE);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page).toHaveURL(/\/kyc$/);
    await expect(page.getByRole('heading', { name: 'Identity', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    // Every other screen sends them back to it.
    await page.goto(`${appUrl('player')}/rewards`);
    await expect(page).toHaveURL(/\/kyc$/);
  });

  test('a wrong code is refused, and says what to do', async ({ page }) => {
    await requestCode(page, '9000000203');
    await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled();
    const code = page.getByRole('textbox', { name: 'Code sent to +91 90000 00203' });
    await code.fill('000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByText('Code wrong or expired. Check it, or request a new one.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send by SMS in \d+ s/ })).toBeDisabled();
    await code.fill('00000');
    await expect(page.getByText('Enter the 6-digit code.')).toBeVisible();
  });

  test('Change number goes back, and a second code inside the minute is refused', async ({ page }) => {
    await requestCode(page, '9000000204');
    await page.getByRole('button', { name: 'Change number' }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000204');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByText('Too many attempts. Wait a minute, then try again.')).toBeVisible();
  });
});
