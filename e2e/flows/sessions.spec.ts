/**
 * Sessions (#127; design prompt, "Sessions"). Sahil Arora, this flow's own duty manager (Auth sends one code a
 * minute to a number), seats Rhea Kaul at Table 2, seat 4; the cage issues her ₹10,000 of chips for cash; she is let
 * go before her call time and cashes out ₹25,000 to her wallet, finally, which closes her visit. On her phone, her
 * history shows this month with the session, up ₹15,000, and its detail: buy-in, cash-out, net and the receipt the
 * cage printed. TDS, markers, the month's totals and the tier gate are proved in supabase/tests/157_my_sessions.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Sessions', () => {
  test('a member reads a session in her history by month, and its detail with the receipt', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'seats a member and moves chips and money, so the local stack only');
    test.setTimeout(120_000);
    const sahil = await browser.newPage();
    await signInToConsole(sahil, '9000000613');
    await sahil.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 2', exact: true }).click();
    await sahil.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '4', exact: true }).click();
    await sahil.getByRole('textbox', { name: 'Mobile number' }).fill('9000000297');
    await sahil.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(sahil.getByRole('button', { name: 'Move Rhea Kaul' })).toBeVisible();

    await sahil.getByRole('link', { name: 'Cage' }).click();
    await sahil.getByRole('textbox', { name: 'Search members' }).fill('Rhea');
    await sahil.getByRole('button', { name: 'Rhea Kaul' }).click();
    await sahil.getByRole('textbox', { name: 'Amount', exact: true }).fill('10000');
    await sahil.getByRole('button', { name: 'Issue chips' }).click();
    await expect(sahil.getByText('₹10,000 of chips issued.')).toBeVisible();

    await sahil.getByRole('link', { name: 'Live floor' }).click();
    await sahil.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 2', exact: true }).click();
    await sahil.getByRole('button', { name: 'Let Rhea Kaul leave early' }).click();
    await sahil.getByRole('textbox', { name: 'Why they leave early' }).fill('Going home');
    await sahil.getByRole('button', { name: 'Let leave early' }).click();
    await expect(sahil.getByText('Early departure recorded. The cage can cash them out.')).toBeVisible();
    await sahil.getByRole('link', { name: 'Cage' }).click();
    await sahil.getByRole('textbox', { name: 'Search members' }).fill('Rhea');
    await sahil.getByRole('button', { name: 'Rhea Kaul' }).click();
    await sahil.getByRole('group', { name: 'Pay to' }).getByRole('button', { name: 'Wallet' }).click();
    await sahil.getByRole('textbox', { name: 'Chips handed back' }).fill('25000');
    await sahil.getByRole('switch', { name: /Final cash-out/ }).click();
    await sahil.getByRole('button', { name: 'Cash out' }).click();
    await expect(sahil.getByText('Cash-out done. ₹25,000 to the wallet.')).toBeVisible();

    const rhea = await browser.newPage();
    await signInToPlayer(rhea, '9000000297', '/sessions');
    await expect(rhea.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(rhea.getByText(/^1 session · /)).toBeVisible();
    const row = rhea.getByRole('button', { name: /Table 2/ });
    await expect(row).toContainText('+₹15,000');
    await row.click();
    await expect(rhea).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/);
    await expect(rhea.getByRole('heading', { name: 'Table 2' })).toBeVisible();
    await expect(rhea.getByText('Buy-in')).toBeVisible();
    await expect(rhea.getByText('₹10,000', { exact: true })).toBeVisible();
    await expect(rhea.getByText('₹25,000', { exact: true })).toBeVisible();
    await expect(rhea.getByText(/^Receipt [0-9A-F]{8}$/)).toBeVisible();
    await expect(rhea.getByText('TDS', { exact: true })).toBeHidden();
    await rhea.getByRole('button', { name: 'Back' }).click();
    await expect(rhea).toHaveURL(/\/sessions$/);
  });
});
