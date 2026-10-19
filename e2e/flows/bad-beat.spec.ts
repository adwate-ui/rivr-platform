/**
 * Bad-beat jackpot payouts (#48, scope-v1 module 8), signed in on the console as a floor supervisor
 * (Leela Pillai, this flow's own number: Auth sends one code a minute to a number). A number that is
 * not a member is refused. A bad beat at Table 3 (Arjun Mehta lost to Kabir Sethi, two others dealt
 * in) is paid in chips under the seeded rule, shown in the history with its split, then reversed with
 * a reason, which puts the jackpot back as it was. Every payout not yet reversed is reversed before
 * and after, so a run that failed halfway leaves the jackpot as other flows expect it. The amounts are
 * proved in packages/testing/golden/jackpot.json and supabase/tests/040 and 041.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** The bad-beat jackpot's amount as the screen shows it. */
function mainPool(page: Page) {
  return page.locator('div').filter({ has: page.getByText('Bad-beat jackpot', { exact: true }) }).getByText(/^₹[\d,]+(\.\d{2})?$/).first();
}

/** Reverses every payout the screen still offers to reverse, latest first. */
async function reverseAll(page: Page) {
  const reverse = page.getByRole('button', { name: /^Reverse the payout of / });
  while ((await reverse.count()) > 0) {
    const before = await reverse.count();
    await page.getByRole('textbox', { name: /^Why the payout of / }).first().fill('End of the test run');
    await reverse.first().click();
    await expect(reverse).toHaveCount(before - 1);
  }
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
    await reverseAll(page);
    const before = await mainPool(page).textContent();
    try {
      await fillBadBeat(page, '9999999999');
      await page.getByRole('button', { name: /^Pay ₹[\d,]+ in chips$/ }).click();
      await expect(page.getByText('One of those numbers is not a member here. Check the numbers.')).toBeVisible();

      await page.getByRole('textbox', { name: 'Loser\'s mobile number' }).fill('9000000201');
      const split = page.getByText(/^Loser ₹[\d,]+ · winner ₹[\d,]+ · ₹[\d,]+ each to 2 others$/).first();
      await expect(split).toBeVisible();
      const shown = await split.textContent();
      await page.getByRole('button', { name: /^Pay ₹[\d,]+ in chips$/ }).click();
      await expect(page.getByText(`Paid: ${shown ?? ''}. Bring the chips to the table.`)).toBeVisible();
      await expect(page.getByText(/· Table 3 · Arjun Mehta lost to Kabir Sethi · ₹[\d,]+$/).first()).toBeVisible();
      await expect(page.getByText(shown ?? '', { exact: true }).last()).toBeVisible();
      await expect(mainPool(page)).not.toHaveText(before ?? '');

      await reverseAll(page);
      await expect(page.getByText(/· Reversed: End of the test run · ₹[\d,]+ back to the jackpot$/).first()).toBeVisible();
      await expect(mainPool(page)).toHaveText(before ?? '');
    } finally {
      await reverseAll(page);
    }
  });
});
