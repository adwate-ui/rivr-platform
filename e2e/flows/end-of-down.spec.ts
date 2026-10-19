/**
 * End of down (#44; scope-v1 module 4), signed in once on the console as a duty manager (Gaurav
 * Sinha, this flow's own sign-in: Auth sends one code a minute to a number), with Pema Lepcha
 * dealing on a tablet at Table 3: she logs a ₹48,000 hand (rake ₹2,400 and a ₹100 drop, ₹2,500
 * logged), ends the down with ₹2,300 in the drop box, sees it is ₹200 short, and the tablet asks for
 * the next dealer. The alert beyond the threshold is proved in supabase/tests/045_end_of_down.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

test.describe('End of down', () => {
  test('End of down: ₹2,300 in the drop box against ₹2,500 logged is ₹200 short, and the next dealer signs in', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and logs hands, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000121');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    await press(tablet, ['4', '8', '000']);
    await tablet.getByRole('button', { name: 'Log hand' }).click();
    await expect(tablet.getByText('Hands this down: 1')).toBeVisible();

    await tablet.getByRole('button', { name: 'End of down' }).click();
    await expect(tablet.getByRole('heading', { name: 'End of down' })).toBeVisible();
    await press(tablet, ['2', '3', '0', '0']);
    await tablet.getByRole('button', { name: 'Close the down' }).click();
    await expect(tablet.getByText('Last down: drop box ₹2,300, logged ₹2,500, variance −₹200.')).toBeVisible();
    await expect(tablet.getByRole('heading', { name: 'Dealer sign-in' })).toBeVisible();
    await revoke(floor, name);
  });
});
