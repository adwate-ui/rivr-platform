/**
 * Player shell (#6): anyone signed out goes to sign-in; a signed-in member gets the five-tab frame
 * with their initial top right, which opens Profile. Rajat Singh, a practice-venue member, so no
 * other flow signs in with his number inside Auth's one-code-a-minute window.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';

const CODE = isRemoteTarget() ? (process.env.E2E_SIGN_IN_CODE ?? '') : '123456';

test.describe('Player shell', () => {
  test.beforeAll(() => {
    if (CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the shell flow cannot sign in on staging');
  });

  test('signed out goes to sign-in; signed in shows the tabs and the member’s initial, which opens Profile', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.player);
    await page.goto(appUrl('player'));
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000406');
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByRole('textbox', { name: /^Code sent to/ }).fill(CODE);
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Main' });
    for (const tab of ['Home', 'Rewards']) await expect(tabs.getByRole('link', { name: tab })).toBeVisible();
    // Balance is hidden (#627): the app shows no rupee.
    await expect(tabs.getByRole('link', { name: 'Balance' })).toHaveCount(0);
    const profile = page.getByRole('link', { name: 'Profile' });
    await expect(profile).toHaveText('C');
    await profile.click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  });
});
