/**
 * Console sign-in (#223): staff sign in with their mobile number and the code sent to it, like
 * members (question #172), and work at the club or, while training, the practice venue, whose stripe
 * stays across the top after a reload until they go back to the club (decision 0444). Someone who
 * is not staff is turned away. Each test uses its own seeded number: Auth sends one code a minute.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { openAccountMenu } from '../support/console.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Console sign-in', { tag: '@staging' }, () => {
  test('a cashier signs in at the club, switches to the practice venue, keeps it after a reload, and signs out', async ({ page }) => {
    await signInToConsole(page, '9000000104');
    await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();
    const menu = await openAccountMenu(page);
    await expect(menu.getByText('Sana Qureshi', { exact: true })).toBeVisible();
    await expect(menu.getByText('Cashier · RIVR Gurugram')).toBeVisible();

    await menu.getByRole('switch', { name: 'Practice venue' }).click();
    await expect(menu.getByText('Cashier · RIVR Practice')).toBeVisible();
    const stripe = page.getByRole('region', { name: 'Practice venue' });
    await expect(stripe).toBeVisible();
    // A reload keeps the practice venue, and its stripe says so (#811).
    await page.reload();
    await expect(stripe).toBeVisible();
    await stripe.getByRole('button', { name: 'Back to the club' }).click();
    await expect(stripe).toHaveCount(0);

    // A bookmark to sign-in on a shared computer says who is signed in, not an empty form (#227).
    await page.goto(`${appUrl('console')}/sign-in`);
    await expect(page.getByText('Sana Qureshi is signed in on this device.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue as Sana Qureshi' }).click();
    await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();

    const again = await openAccountMenu(page);
    await again.getByRole('button', { name: 'Sign out' }).click();
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
