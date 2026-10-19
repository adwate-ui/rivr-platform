/**
 * High hands (#47; design prompt flow 6), signed in once on the console as a duty manager (Kavya
 * Reddy, this flow's own sign-in: Auth sends one code a minute to a number), with Pema Lepcha
 * dealing on a tablet at Table 3:
 * - Pema logs a hand with a high-hand claim: straight flush, seat 4, and it goes to the floor;
 * - the floor sees it waiting on the console's High hands screen and approves ₹10,000;
 * - the tablet shows it approved, and the history records who paid it.
 * The ledger (₹10,000 of chips into play at the club's cost) and tonight's best for the TV
 * (public_high_hand) are proved in supabase/tests/043_high_hands.test.sql; the TV shows it with #65.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

test.describe('High hands', () => {
  test('High hand: a straight flush at seat 4 is claimed on the tablet and approved for ₹10,000 on the console', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and pays a high hand, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000118');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    // The pot first: once the claim is open, the seats share the keypad's names.
    await press(tablet, ['2', '0', '000']);
    await tablet.getByRole('switch', { name: 'High hand' }).click();
    await tablet.getByRole('group', { name: 'Type of hand' }).getByRole('button', { name: 'Straight flush', exact: true }).click();
    await tablet.getByRole('group', { name: 'Seat' }).getByRole('button', { name: '4', exact: true }).click();
    await tablet.getByRole('button', { name: 'Log hand' }).click();
    await expect(tablet.getByText('High hand sent to the floor.')).toBeVisible();
    await expect(tablet.getByText('Hands this down: 1')).toBeVisible();
    await expect(tablet.getByText('High hand claimed, waiting for the floor')).toBeVisible();

    await floor.getByRole('link', { name: 'High hands' }).click();
    await expect(floor.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
    await expect(floor.getByText(/^Straight flush, seat 4, Table 3 · .+, \d{2}:\d{2} · dealt by Pema Lepcha$/).first()).toBeVisible();
    const paid = floor.getByText('Paid ₹10,000, approved by Kavya Reddy', { exact: true });
    const before = await paid.count();
    await floor.getByRole('button', { name: 'Approve ₹10,000' }).first().click();
    await expect(paid).toHaveCount(before + 1);

    // The tablet asks again every fifteen seconds.
    await expect(tablet.getByText('High hand approved')).toBeVisible({ timeout: 20_000 });
    await revoke(floor, name);
  });
});
