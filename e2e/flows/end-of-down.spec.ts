/**
 * End of down (#44; scope-v1 module 4), signed in once on the console as a duty manager (Gaurav
 * Sinha, this flow's own sign-in: Auth sends one code a minute to a number), with Pema Lepcha
 * dealing on a tablet at Table 3: she ends her down, which asks for no drop-box count and shows no
 * rupee (#630, decision 0284), and the tablet asks for the next dealer.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, revoke, tabletAtTable3 } from '../support/tablet.ts';

test.describe('End of down', () => {
  test('End of down: the dealer hands the table over with no count, and the next dealer signs in', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and takes Table 3, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000121');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);

    await tablet.getByRole('button', { name: 'End of down' }).click();
    await expect(tablet.getByRole('heading', { name: 'End of down' })).toBeVisible();
    await expect(tablet.getByText('Hand the table over: the down ends and the next dealer signs in.')).toBeVisible();
    await expect(tablet.getByText(/₹/)).toHaveCount(0);
    await tablet.getByRole('button', { name: 'Close the down' }).click();
    await expect(tablet.getByRole('heading', { name: 'Dealer sign-in' })).toBeVisible();
    await expect(tablet.getByText(/Last down/)).toHaveCount(0);
    await revoke(floor, name);
  });
});
