/**
 * Deposit (#29; design prompt Deposit). Vihaan Kapoor, this flow's own member (Auth sends one code a
 * minute to a number), opens Deposit from Balance: the club's UPI address and name to pay from his verified
 * Axis Bank UPI. He enters the ₹20,000 he paid and its UTR; Balance says the cage confirms it against the UTR.
 * Farah Khan, this flow's own cashier, finds the UTR in the bank statement from his UPI and types the amount the
 * bank shows (decision 0064), and Vihaan reads "Deposit received. ₹20,000 added to cash." A deposit moves
 * money, so a local rerun needs `pnpm db:reset` first.
 * Who may, the UTR rules and a frozen venue are proved in supabase/tests/066_deposits.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const UTR = '512345678901';

test.describe('Deposit', () => {
  test('Deposit: a member pays the club\'s UPI and enters the UTR; the cashier confirms it against the bank and it reaches his wallet', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'moves a member\'s money, so the local stack only');
    const vihaan = await browser.newPage();
    await signInToPlayer(vihaan, '9000000212');
    await vihaan.getByRole('link', { name: 'Balance' }).click();
    await vihaan.getByRole('button', { name: 'Deposit' }).click();
    await expect(vihaan.getByText('rivr.gurugram@icici', { exact: true })).toBeVisible();
    await vihaan.getByRole('textbox', { name: 'Amount paid' }).fill('20000');
    await vihaan.getByRole('textbox', { name: 'UTR' }).fill(UTR);
    await vihaan.getByRole('button', { name: 'Submit' }).click();
    await expect(vihaan.getByText('Deposit submitted. The cage confirms it against the UTR.')).toBeVisible();

    const farah = await browser.newPage();
    await signInToConsole(farah, '9000000139');
    await farah.getByRole('link', { name: 'Cage' }).click();
    const waiting = farah.getByText(new RegExp(`^UTR ${UTR} · submitted`));
    await expect(waiting).toBeVisible();
    await expect(farah.getByText('From UPI vihaan.kapoor@okaxis · Axis Bank')).toBeVisible();
    await farah.getByRole('textbox', { name: 'Amount in the bank statement' }).fill('20000');
    await farah.getByRole('button', { name: 'Confirm received' }).click();
    await expect(waiting).toHaveCount(0);

    await vihaan.reload();
    await expect(vihaan.getByText('Deposit received. ₹20,000 added to cash.')).toBeVisible();
    await expect(vihaan.getByText(`Deposit · UTR ${UTR}`, { exact: true })).toBeVisible();
  });
});
