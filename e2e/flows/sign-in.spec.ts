/**
 * Sign-in (#2; decision 0320): a member signs in with their mobile number and the code sent to it, and lands
 * on Tonight; a member whose identity check is not done sees only the check (#632). Each test uses its own seeded member, because Auth sends one code a
 * minute to a number (a rerun inside that minute is refused as too many requests). Titles follow the prototype's panel.
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

test.describe('Sign in', { tag: '@staging' }, () => {
  test.beforeAll(() => {
    if (CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the sign-in flow cannot sign in on staging');
  });

  test('Sign in › Cookies: a first launch asks once, and Essential only keeps the answer', async ({ browser }) => {
    // A phone that has never opened the app: none of the config's answered cookie choice.
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: VIEWPORT.player });
    const page = await context.newPage();
    await page.goto(`${appUrl('player')}/sign-in`);
    const sheet = page.getByRole('dialog', { name: 'Cookies' });
    await expect(sheet.getByText('Essential storage only, unless you allow analytics.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Allow analytics' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Essential only' }).click();
    await expect(sheet).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Cookies' })).toHaveCount(0);
    await context.close();
  });

  test('Sign in › Phone error: a number that is not ten digits is refused under the field', async ({ page }) => {
    await requestCode(page, '98765');
    await expect(page.getByText('Enter a 10-digit mobile number.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Enter the code' })).toHaveCount(0);
  });

  test('Sign in › Code (auto-fill): the code sent by WhatsApp goes on by itself and lands on Tonight', async ({ page }) => {
    test.skip(isRemoteTarget(), 'signs in with a number staging does not list as a test number, so the local stack only');
    await requestCode(page, '90000 00281');
    await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeVisible();
    await expect(page.getByText('Sent on WhatsApp to +91 90000 00281')).toBeVisible();
    // Six digits in, the code goes on by itself (S-01).
    await page.getByRole('textbox', { name: '6-digit code' }).fill(CODE);
    await expect(page.getByRole('heading', { name: 'Tonight', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    // Signed in, Back does not lead to the sign-in screen again.
    await page.goBack();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toHaveCount(0);
  });

  test('Identity › Start: a member whose identity check is not done sees only the check (#632)', async ({ page }) => {
    await requestCode(page, '90000 00202');
    await page.getByRole('textbox', { name: '6-digit code' }).fill(CODE);
    await expect(page).toHaveURL(/\/kyc$/);
    await expect(page.getByRole('heading', { name: /^(Verify your identity|Pick up where you left off)$/, level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    // Every other screen sends them back to it.
    await page.goto(`${appUrl('player')}/rewards`);
    await expect(page).toHaveURL(/\/kyc$/);
  });

  test('Sign in › Wrong code: refused under the cells, which empty for the next, with a new code once the minute is up', async ({ page }) => {
    await requestCode(page, '9000000203');
    await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await page.getByRole('textbox', { name: '6-digit code' }).fill('000000');
    await expect(page.getByText("That code didn't match.")).toBeVisible();
    await expect(page.getByRole('textbox', { name: '6-digit code' })).toHaveValue('');
    await expect(page.getByRole('button', { name: /^Resend code in \d:\d\d$/ })).toBeDisabled();
  });

  test('Sign in › Phone: Back changes the number, and a second code inside the minute is refused', async ({ page }) => {
    await requestCode(page, '9000000204');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000204');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByText('Too many tries. Wait a minute.')).toBeVisible();
  });
});
