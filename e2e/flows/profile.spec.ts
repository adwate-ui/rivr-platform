/**
 * Profile (#7): behind the member's initial, the identity check, the games for waitlist alerts,
 * notifications and promotions, and the way to limits and self-exclusion. Choices survive a reload.
 * Each run flips a choice and checks it held, so runs after the first still prove something. Tara
 * Menon is this flow's own member: Auth sends one code a minute to a number, so no other flow signs
 * in as her.
 */
import { expect, test, type Locator } from '@playwright/test';
import { signInToPlayer } from '../support/signIn.ts';

/** Presses a control and checks its state flipped; returns the state it should keep. */
async function flip(control: Locator, attribute: 'aria-pressed' | 'aria-checked'): Promise<string> {
  const now = String((await control.getAttribute(attribute)) !== 'true');
  await control.click();
  await expect(control).toHaveAttribute(attribute, now);
  return now;
}

test.describe('Profile', () => {
  test('a member keeps their games, notifications and promotions choice, and finds limits', async ({ page }) => {
    await signInToPlayer(page, '9000000209');
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
    await expect(page.getByText('KYC incomplete. Finish it to join a table.')).toBeVisible();

    const plo = page.getByRole('button', { name: 'PLO' });
    const promotions = page.getByRole('switch', { name: 'Promotions and offers' });
    const seatCalls = page.getByRole('switch', { name: 'Seat calls' });
    const ploPressed = await flip(plo, 'aria-pressed');
    const promotionsOn = await flip(promotions, 'aria-checked');
    const seatCallsOn = await flip(seatCalls, 'aria-checked');

    await page.reload();
    await expect(plo).toHaveAttribute('aria-pressed', ploPressed);
    await expect(promotions).toHaveAttribute('aria-checked', promotionsOn);
    await expect(seatCalls).toHaveAttribute('aria-checked', seatCallsOn);

    await page.getByRole('button', { name: 'Limits and self-exclusion' }).click();
    await expect(page.getByRole('heading', { name: 'Limits and self-exclusion' })).toBeVisible();
  });
});
