/**
 * Balance (#18) and Withdrawal (#21; design prompt flow 9). Arjun Mehta, this flow's own member (Auth
 * sends one code a minute to a number, so Balance and Withdrawal are one flow), opens Balance: ₹1,85,000
 * of cash, his ₹4,000 bonus expiring Sunday and 18,420 points together, his open ₹50,000 marker against a
 * ₹2,00,000 limit, and the seed's opening balances among his movements. He then withdraws ₹1,00,000 to
 * HDFC Bank: Imran Siddiqui, the cashier, cannot send it alone; Devika Rana, the floor manager, approves
 * it as second approver on her own console; Imran sends it with UTR 412908771204, and Arjun reads
 * "Withdrawal sent. UTR 412908771204." Who sees what is proved in supabase/tests/062 and 065. The withdrawal
 * cannot be undone from the apps until deposits (#29), so a local rerun needs `pnpm db:reset` first; CI always starts fresh.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const UTR = '412908771204';

/** Arjun's Balance as the design prompt has it. */
async function seesBalance(page: Page) {
  await page.getByRole('link', { name: 'Balance' }).click();
  await expect(page.getByRole('heading', { name: 'Balance', level: 1 })).toBeVisible();
  await expect(page.getByText('₹1,85,000', { exact: true })).toBeVisible();
  await expect(page.getByText(/^₹4,000 bonus · expires Sunday 23:59$/)).toBeVisible();
  await expect(page.getByText('18,420 points', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Markers' })).toBeVisible();
  await expect(page.getByText(/^Issued \d{1,2} [A-Z][a-z]{2} · due \d{1,2} [A-Z][a-z]{2}$/)).toBeVisible();
  await expect(page.getByText('₹50,000', { exact: true })).toBeVisible();
  await expect(page.getByText('Limit ₹2,00,000 · available ₹1,50,000', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Movements' })).toBeVisible();
  await expect(page.getByText('Opening balance', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('+₹1,85,000', { exact: true })).toBeVisible();
  await expect(page.getByText('+₹4,000', { exact: true })).toBeVisible();
  await expect(page.getByText('₹50,000 owed', { exact: true })).toBeVisible();
}

/** The cage's Withdrawals screen for a staff member. */
async function withdrawalsFor(page: Page, number: string) {
  await signInToConsole(page, number);
  await page.getByRole('link', { name: 'Withdrawals' }).click();
  await expect(page.getByText('Arjun Mehta', { exact: true })).toBeVisible();
}

test.describe('Balance', () => {
  test('Balance and Withdrawal: Arjun sees his money together, then withdraws ₹1,00,000 to HDFC Bank, sent once a second approver approves', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'moves a member\'s money, so the local stack only');
    test.setTimeout(120_000);
    const arjun = await browser.newPage();
    await signInToPlayer(arjun, '9000000201');
    await seesBalance(arjun);

    await arjun.getByRole('button', { name: 'Withdraw' }).click();
    await arjun.getByRole('textbox', { name: 'Amount' }).fill('100000');
    await expect(arjun.getByText('Cash available ₹1,85,000')).toBeVisible();
    await expect(arjun.getByRole('button', { name: 'HDFC Bank · UPI arjun.mehta@hdfcbank' })).toHaveAttribute('aria-pressed', 'true');
    await arjun.getByRole('button', { name: 'Confirm withdrawal' }).click();
    await expect(arjun.getByText('Withdrawal pending · ₹1,00,000 to HDFC Bank')).toBeVisible();
    await expect(arjun.getByText('₹85,000', { exact: true })).toBeVisible();

    const imran = await browser.newPage();
    await withdrawalsFor(imran, '9000000137');
    await expect(imran.getByText('Second approver needed')).toBeVisible();
    await imran.getByRole('textbox', { name: 'UTR' }).fill(UTR);
    await imran.getByRole('button', { name: 'Approve and send' }).click();
    await expect(imran.getByText('A second approver, other than you, must approve this first.')).toBeVisible();

    const devika = await browser.newPage();
    await withdrawalsFor(devika, '9000000138');
    await devika.getByRole('button', { name: 'Approve as second approver' }).click();
    await expect(devika.getByText('Approved by Devika Rana')).toBeVisible();

    await imran.getByRole('button', { name: 'Approve and send' }).click();
    await expect(imran.getByText(`Withdrawal sent. UTR ${UTR}.`)).toBeVisible();
    await expect(imran.getByText('No withdrawals waiting.')).toBeVisible();

    await arjun.reload();
    await expect(arjun.getByText(`Withdrawal sent. UTR ${UTR}.`)).toBeVisible();
  });
});
