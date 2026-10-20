/**
 * High hands (#47 and #324; design prompt flow 6), signed in once on the console as a duty manager
 * (Kavya Reddy, this flow's own sign-in: Auth sends one code a minute to a number), with Pema Lepcha
 * dealing on a tablet at Table 3:
 * - Pema logs a hand with a high-hand claim, tapping four of a kind, Queens, seat 4, for what was a
 *   straight flush, and it goes to the floor;
 * - the floor corrects it to a straight flush before deciding, the dealer's claim kept beside it, and
 *   approves ₹10,000: the chips in play rise by ₹10,000;
 * - the floor then reverses it with the reason: the payout is posted back, so the chips in play are as
 *   before, and the tablet shows the claim corrected, then reversed.
 * The ledger postings, the audit log, claiming the hand again and tonight's best for the TV are proved in
 * supabase/tests/043_high_hands.test.sql and 086_high_hand_corrections.test.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

/** The Treasury's chips in play, in rupees: what the cage owes the room. */
async function chipsInPlay(page: Page): Promise<number> {
  await page.getByRole('link', { name: 'Treasury' }).click();
  const label = page.getByText('Chips in play', { exact: true });
  await expect(label).toBeVisible();
  const figure = (await label.locator('xpath=..').innerText()).replace('Chips in play', '');
  return (/[−-]/.test(figure) ? -1 : 1) * Number(figure.replace(/[^\d]/g, ''));
}

test.describe('High hands', () => {
  test('High hand: a four of a kind claimed for a straight flush is corrected and paid ₹10,000, then reversed, and the chips in play balance', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and pays a high hand, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000118');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    // The pot first: once the claim is open, the seats share the keypad's names.
    await press(tablet, ['2', '0', '000']);
    await tablet.getByRole('switch', { name: 'High hand' }).click();
    await tablet.getByRole('group', { name: 'Type of hand' }).getByRole('button', { name: 'Four of a kind', exact: true }).click();
    await tablet.getByRole('group', { name: 'Rank' }).getByRole('button', { name: 'Queens', exact: true }).click();
    await tablet.getByRole('group', { name: 'Seat' }).getByRole('button', { name: '4', exact: true }).click();
    await tablet.getByRole('button', { name: 'Log hand' }).click();
    await expect(tablet.getByText('High hand sent to the floor.')).toBeVisible();
    await expect(tablet.getByText('High hand claimed, waiting for the floor')).toBeVisible();

    const before = await chipsInPlay(floor);
    await floor.getByRole('link', { name: 'High hands' }).click();
    await expect(floor.getByText(/^Four of a kind Queens, seat 4, Table 3 · .+ · dealt by Pema Lepcha$/).first()).toBeVisible();
    await floor.getByRole('button', { name: 'Correct', exact: true }).first().click();
    await floor.getByRole('group', { name: 'Hand' }).getByRole('button', { name: 'Straight flush', exact: true }).click();
    await floor.getByRole('button', { name: 'Save the correction' }).click();
    const corrected = floor.getByText('Corrected by Kavya Reddy from Four of a kind Queens, seat 4', { exact: true });
    await expect(corrected).toBeVisible();
    await expect(floor.getByText(/^Straight flush, seat 4, Table 3 · .+ · dealt by Pema Lepcha$/).first()).toBeVisible();
    const paid = floor.getByText('Paid ₹10,000, approved by Kavya Reddy', { exact: true });
    const paidBefore = await paid.count();
    await floor.getByRole('button', { name: 'Approve ₹10,000' }).first().click();
    await expect(paid).toHaveCount(paidBefore + 1);
    // The tablet asks again every fifteen seconds.
    await expect(tablet.getByText('Corrected by the floor')).toBeVisible({ timeout: 20_000 });
    await expect(tablet.getByText('High hand approved')).toBeVisible({ timeout: 20_000 });
    expect(Math.abs(await chipsInPlay(floor) - before)).toBe(10_000);

    // The latest decided claim is first in the history: this one.
    await floor.getByRole('link', { name: 'High hands' }).click();
    await floor.getByRole('button', { name: 'Reverse', exact: true }).first().click();
    await floor.getByRole('textbox', { name: 'Why it is reversed' }).fill('The board was misread');
    await floor.getByRole('button', { name: 'Reverse the claim' }).click();
    await expect(floor.getByText('Reversed by Kavya Reddy: The board was misread', { exact: true })).toBeVisible();
    expect(await chipsInPlay(floor)).toBe(before);
    await expect(tablet.getByText('High hand reversed by the floor')).toBeVisible({ timeout: 20_000 });
    await revoke(floor, name);
  });
});
