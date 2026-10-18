/**
 * Console sign-in (#223): staff sign in with their mobile number and the code sent to it, like
 * members (question #172), and work at the club or, while training, the practice venue. Someone who
 * is not staff is turned away. Each test uses its own seeded number: Auth sends one code a minute.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Console sign-in', () => {
  test('a cashier signs in at the club, switches to the practice venue, and signs out', async ({ page }) => {
    await signInToConsole(page, '9000000104');
    await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();
    const rail = page.getByRole('complementary');
    await expect(rail.getByText('Sana Qureshi')).toBeVisible();
    await expect(rail.getByText('RIVR Gurugram')).toBeVisible();

    await rail.getByRole('switch', { name: 'Practice venue' }).click();
    await expect(rail.getByText('RIVR Practice')).toBeVisible();

    // A bookmark to sign-in on a shared computer says who is signed in, not an empty form (#227).
    await page.goto(`${appUrl('console')}/sign-in`);
    await expect(page.getByText('Sana Qureshi is signed in on this device.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();

    await rail.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
  });

  test('someone who is not staff is turned away, and can sign out', async ({ page }) => {
    test.skip(isRemoteTarget(), 'signs in with a number that is not seeded, so the local stack only');
    await signInToConsole(page, '9000000903');
    await expect(page.getByRole('heading', { name: 'Staff only' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
  });
});
