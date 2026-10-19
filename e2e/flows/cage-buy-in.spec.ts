/**
 * Cage buy-in (#57; scope-v1 module 5; the prototype's Cage). Aisha Khan, this flow's own duty manager
 * (Auth sends one code a minute to a number), seats Vihaan Kapoor at Table 1 (NLH 50/100, buy-in
 * ₹5,000), finds him at the cage and issues ₹5,000 of chips for cash; a wallet buy-in is refused for
 * want of wallet cash, ₹4,950 is below the table's minimum and ₹5,020 is not whole chips. The table's request and Approve from
 * wallet (flow 3) are proved in supabase/tests/049_cage_buy_in.test.sql; the tablet's Buy-in is #59.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Cage buy-in', () => {
  test('a cashier issues chips for cash to a seated member; the wallet and the table minimum hold', async ({ page }) => {
    test.skip(isRemoteTarget(), 'seats a member and issues chips, so the local stack only');
    await signInToConsole(page, '9000000126');
    await page.getByRole('group', { name: 'Table' }).first().getByRole('button', { name: 'Table 1', exact: true }).click();
    await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000212');
    await page.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Move Vihaan Kapoor' })).toBeVisible();

    await page.getByRole('link', { name: 'Cage' }).click();
    await page.getByRole('textbox', { name: 'Search members' }).fill('Vihaan');
    await page.getByRole('button', { name: 'Vihaan Kapoor' }).click();
    await expect(page.getByText(/KYC verified · Table 1, seat 3$/)).toBeVisible();

    const amount = page.getByRole('textbox', { name: 'Amount' });
    await amount.fill('5000');
    await page.getByRole('button', { name: 'Issue chips' }).click();
    await expect(page.getByText('₹5,000 of chips issued.')).toBeVisible();

    await page.getByRole('group', { name: 'Pay by' }).getByRole('button', { name: 'Wallet' }).click();
    await amount.fill('5000');
    await page.getByRole('button', { name: 'Issue chips' }).click();
    await expect(page.getByText('The wallet holds less than ₹5,000. Take cash at the cage or decline.')).toBeVisible();

    await page.getByRole('group', { name: 'Pay by' }).getByRole('button', { name: 'Cash' }).click();
    await amount.fill('4950');
    await page.getByRole('button', { name: 'Issue chips' }).click();
    await expect(page.getByText('₹4,950 is below the table\'s minimum buy-in.')).toBeVisible();

    await amount.fill('5020');
    await page.getByRole('button', { name: 'Issue chips' }).click();
    await expect(page.getByText('₹5,020 is not whole ₹50 chips.')).toBeVisible();
  });
});
