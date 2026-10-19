/**
 * Bad-beat jackpot payouts (#48, scope-v1 module 8), signed in on the console as a floor supervisor
 * (Leela Pillai, this flow's own number: Auth sends one code a minute to a number). A number that is
 * not a member is refused. A bad beat at Table 3 (Arjun Mehta lost to Kabir Sethi, two others dealt
 * in) is paid in chips under the seeded rule, shown in the history, then reversed with a reason, which
 * puts the jackpot back as it was, so other flows find it unchanged. The amounts themselves are proved
 * in packages/testing/golden/jackpot.json and supabase/tests/040_jackpot_payouts.test.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** The bad-beat jackpot's amount as the screen shows it. */
function mainPool(page: Page) {
  return page.locator('div').filter({ has: page.getByText('Bad-beat jackpot', { exact: true }) }).getByText(/^₹[\d,]+(\.\d{2})?$/).first();
}

async function fillBadBeat(page: Page, loser: string) {
  await page.getByRole('group', { name: 'Table' }).getByRole('button', { name: 'Table 3', exact: true }).click();
  await page.getByRole('textbox', { name: 'Loser\'s mobile number' }).fill(loser);
  await page.getByRole('textbox', { name: 'Winner\'s mobile number' }).fill('9000000202');
  await page.getByRole('textbox', { name: 'Others dealt in' }).fill('9000000203, 9000000204');
}

test.describe('Jackpots', () => {
  test('Bad beat: a stranger is refused; a bad beat at Table 3 is paid in chips, listed, and reversed back into the jackpot', async ({ page }) => {
    test.skip(isRemoteTarget(), 'pays and reverses a jackpot, so the local stack only');
    await signInToConsole(page, '9000000116');
    await page.getByRole('link', { name: 'Jackpots' }).click();
    await expect(mainPool(page)).toBeVisible();
    const before = await mainPool(page).textContent();

    await fillBadBeat(page, '9999999999');
    await page.getByRole('button', { name: /^Pay ₹[\d,]+ in chips$/ }).click();
    await expect(page.getByText('One of those numbers is not a member here. Check the numbers.')).toBeVisible();

    await page.getByRole('textbox', { name: 'Loser\'s mobile number' }).fill('9000000201');
    await expect(page.getByText(/^Loser ₹[\d,]+ · winner ₹[\d,]+ · ₹[\d,]+ each to 2 others$/)).toBeVisible();
    await page.getByRole('button', { name: /^Pay ₹[\d,]+ in chips$/ }).click();
    await expect(page.getByText('Paid. Bring the chips to the table.')).toBeVisible();
    const paid = page.getByText(/· Table 3 · Arjun Mehta lost to Kabir Sethi · ₹[\d,]+$/).first();
    await expect(paid).toBeVisible();
    await expect(mainPool(page)).not.toHaveText(before ?? '');

    await page.getByRole('textbox', { name: 'Why it is reversed' }).first().fill('End of the test run');
    await page.getByRole('button', { name: /^Reverse the payout of / }).first().click();
    await expect(page.getByText(/· Reversed: End of the test run · ₹[\d,]+ back to the jackpot$/).first()).toBeVisible();
    await expect(mainPool(page)).toHaveText(before ?? '');
  });
});
