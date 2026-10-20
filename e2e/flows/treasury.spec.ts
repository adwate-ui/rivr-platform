/**
 * Treasury (#24). Rohit Chauhan, this flow's own cashier, opens the Treasury: what the venue holds for
 * players and the chips in play, from the ledger, and no shift open. He opens the cage's shift with
 * ₹12,00,000 of float and the chips counted by denomination (₹6,50,000 in the cage), then counts again
 * after two ₹5,000 chips go out. Who sees what is proved in supabase/tests/068. One shift is open at a
 * time and #45 closes it, so a local rerun needs `pnpm db:reset` first; CI always starts fresh.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** How many of each chip, smallest first, by its field. */
async function countChips(page: Page, quantities: Record<string, string>) {
  for (const [chip, quantity] of Object.entries(quantities)) {
    await page.getByRole('textbox', { name: `${chip} chips` }).fill(quantity);
  }
}

test.describe('Treasury', () => {
  test('Treasury: Rohit opens the cage\'s shift with the float and the chips counted, then counts again', async ({ page }) => {
    test.skip(isRemoteTarget(), 'opens the cage\'s one shift, so the local stack only');
    await signInToConsole(page, '9000000140');
    await page.getByRole('link', { name: 'Treasury' }).click();
    await expect(page.getByRole('heading', { name: 'Treasury', level: 1 })).toBeVisible();
    for (const row of ['Member wallets', 'Withdrawals pending', 'Bonus liability', 'Markers outstanding', 'Jackpots held', 'Chips in play']) {
      await expect(page.getByText(row, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('No shift open', { exact: true })).toBeVisible();

    await page.getByRole('textbox', { name: 'Float in the drawer' }).fill('1200000');
    await countChips(page, { '₹50': '400', '₹100': '300', '₹500': '200', '₹1,000': '100', '₹5,000': '40', '₹25,000': '8' });
    await page.getByRole('button', { name: 'Open shift' }).click();
    await expect(page.getByText('Shift opened.')).toBeVisible();
    await expect(page.getByText(/^Opened [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2} by Rohit Chauhan$/)).toBeVisible();
    await expect(page.getByText('₹12,00,000', { exact: true })).toBeVisible();
    await expect(page.getByText('₹6,50,000', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Counted .* by Rohit Chauhan$/)).toBeVisible();

    await page.getByRole('button', { name: 'Count chips' }).click();
    await expect(page.getByRole('textbox', { name: '₹5,000 chips' })).toHaveValue('40');
    await countChips(page, { '₹5,000': '38' });
    await page.getByRole('button', { name: 'Save count' }).click();
    await expect(page.getByText('Count saved.')).toBeVisible();
    await expect(page.getByText('₹6,40,000', { exact: true })).toBeVisible();
  });
});
