/**
 * Profile (#7; decision 0320): behind the member's initial, with Back to the tab it came from; the member, Account,
 * Notifications and Club, and sign out (#207). Choices survive a reload. Games for waitlist alerts, limits and Take a break
 * left the app (decision 0322; the server keeps them). Each run flips a choice and checks it held, so runs after the first
 * still prove something. Mrinal Thakur, whose identity check is done, is this flow's own member: Auth sends one code a
 * minute to a number, so no other flow signs in as them.
 */
import { expect, test, type Locator } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

/** Presses a switch and checks its state flipped; returns the state it should keep. */
async function flip(control: Locator): Promise<string> {
  const now = String((await control.getAttribute('aria-checked')) !== 'true');
  await control.click();
  await expect(control).toHaveAttribute('aria-checked', now);
  return now;
}

test.describe('Profile', () => {
  test('Profile › Profile: a member keeps their notifications and offers choice, finds no limits, and signs out', async ({ page }) => {
    await signInToPlayer(page, '9000000402');
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mrinal Thakur', level: 1 })).toBeVisible();
    await expect(page.getByText('Verified', { exact: true })).toBeVisible();

    const offers = page.getByRole('switch', { name: 'Offers', exact: true });
    const seatCalls = page.getByRole('switch', { name: 'Seat calls', exact: true });
    const offersOn = await flip(offers);
    const seatCallsOn = await flip(seatCalls);

    await page.reload();
    await expect(offers).toHaveAttribute('aria-checked', offersOn);
    await expect(seatCalls).toHaveAttribute('aria-checked', seatCallsOn);

    // Gone from the app (decision 0322): waitlist alerts' games, limits and a break.
    await expect(page.getByRole('group', { name: 'Session reminder' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Take a break' })).toHaveCount(0);

    // Profile ends with sign out (#207): back to sign-in, and Profile, opened by its address, is out of reach.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
    // Signing out starts afresh: the next person to sign in on this phone lands on Tonight (#233).
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto(`${appUrl('player')}/profile`);
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mrinal Thakur', level: 1 })).toHaveCount(0);
  });
});
