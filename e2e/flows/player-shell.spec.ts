/**
 * Player shell (#6; decision 0320; redesign RD-05): anyone signed out goes to sign-in; a signed-in member gets the tabs
 * (Home, Sessions, Bonus, Profile) with their initial top right, which opens Profile too. Rajat Singh, a practice-venue member, so no
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
    await page.getByRole('textbox', { name: '6-digit code' }).fill(CODE);

    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
    const tabs = page.getByRole('navigation', { name: 'Main' });
    for (const tab of ['Home', 'Sessions', 'Bonus', 'Profile']) await expect(tabs.getByRole('link', { name: tab })).toBeVisible();
    // Balance is hidden (#627): the app shows no rupee. The card left with the redesign.
    for (const gone of ['Balance', 'Card']) await expect(tabs.getByRole('link', { name: gone })).toHaveCount(0);
    const initial = page.getByRole('main').getByRole('link', { name: 'Profile' });
    await expect(initial).toHaveText('C');
    await initial.click();
    await expect(page).toHaveURL(/\/profile$/);
    // Profile is a tab: the bar stays, with Profile marked, and Home is a tap away.
    await expect(tabs.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  });
});
