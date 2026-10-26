/**
 * Credit and accounts (#92, #94, #95; decisions 0167 and 0168). Ira Sethi, this flow's own duty manager
 * (Auth sends one code a minute to a number), seats Devansh Malik, its own member, at Table 3, seat 6, gives
 * him ₹50,000 of credit and issues him a ₹20,000 marker. Devansh repays ₹5,000 in cash: the credit report
 * shows ₹15,000 owed, 0 to 7 days old. He pays the rest by UPI and is off the report, and he leaves the
 * table. Then Karan Ahuja, another duty manager, adds a UPI account, moves ₹1,000 from the drawer into it (its statement shows the
 * transfer), and asks for a ₹500 expense from it with a photo of the receipt. Meher Gill, the general
 * manager, approves it on her console, and the account is down to ₹500. Refusals (more than owed, a UTR
 * used twice, the one who asked approving) are proved in supabase/tests/098_credit_and_accounts.test.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

// A 1 by 1 pixel PNG: the receipt's photo.
const RECEIPT = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Signs on the pad with one stroke of the mouse, as the Markers flow does. */
async function sign(page: Page, label: string) {
  const pad = page.getByRole('img', { name: label });
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (box === null) throw new Error('The signature pad is not on screen');
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 3, box.y + 20, { steps: 5 });
  await page.mouse.move(box.x + (box.width * 2) / 3, box.y + box.height - 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled();
}

/** Devansh sits at Table 3, has ₹50,000 of credit, and signs a ₹20,000 marker at the cage. */
async function issueDevanshAMarker(page: Page) {
  await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
  await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '6', exact: true }).click();
  await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000296');
  await page.getByRole('button', { name: 'Seat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move Devansh Malik' })).toBeVisible();
  await page.getByRole('link', { name: 'Markers' }).click();
  await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000296');
  await page.getByRole('textbox', { name: 'Limit' }).fill('50000');
  await page.getByRole('textbox', { name: 'Why' }).fill('A regular');
  await page.getByRole('button', { name: 'Set limit' }).click();
  await expect(page.getByText('Limit in force.')).toBeVisible();
  await page.getByRole('link', { name: 'Cage' }).click();
  await page.getByRole('textbox', { name: 'Search members' }).fill('Devansh');
  await page.getByRole('button', { name: 'Devansh Malik' }).click();
  await page.getByRole('textbox', { name: 'Marker amount' }).fill('20000');
  await sign(page, 'Signature of Devansh Malik for ₹20,000');
  await page.getByRole('button', { name: 'Issue marker' }).click();
  await expect(page.getByText('₹20,000 issued on a marker.')).toBeVisible();
}

/** A repayment on the Markers screen: who, how much, and how. */
async function repay(page: Page, amount: string, utr: string | null) {
  await page.getByRole('group', { name: 'Who is paying' }).getByRole('button', { name: 'Devansh Malik' }).click();
  await page.getByRole('textbox', { name: 'Amount' }).fill(amount);
  await page.getByRole('group', { name: 'Paid by' }).getByRole('button', { name: utr === null ? 'Cash' : 'UPI' }).click();
  if (utr !== null) await page.getByRole('textbox', { name: 'UTR' }).fill(utr);
  await page.getByRole('button', { name: 'Take repayment' }).click();
}

test.describe('Credit and accounts', () => {
  test('Credit: a marker is repaid part in cash and the rest by UPI, and the daily report shows what is owed by age', async ({ page }) => {
    test.skip(isRemoteTarget(), 'seats a member, gives credit and issues a marker, so the local stack only');
    await signInToConsole(page, '9000000194');
    await issueDevanshAMarker(page);

    await page.getByRole('link', { name: 'Markers' }).click();
    await repay(page, '5000', null);
    await expect(page.getByText('₹5,000 repaid.')).toBeVisible();
    const report = page.getByRole('table', { name: 'Credit outstanding by player and age' });
    const devansh = report.getByRole('row').filter({ hasText: 'Devansh Malik' });
    await expect(devansh).toContainText('₹15,000');

    // A UTR the club has not seen, so a run again finds it unused.
    await repay(page, '15000', String(Date.now()).slice(-12).padStart(12, '5'));
    await expect(page.getByText('₹15,000 repaid.')).toBeVisible();
    await expect(devansh).toHaveCount(0);

    await page.getByRole('link', { name: 'Live floor' }).click();
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    await page.getByRole('button', { name: 'Devansh Malik leaves' }).click();
    await expect(page.getByRole('button', { name: 'Move Devansh Malik' })).toHaveCount(0);
  });

  test('Accounts and expenses: money moves into a new UPI account, and an expense from it posts once a second person approves', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'moves money and posts an expense, so the local stack only');
    const run = String(Date.now()).slice(-5);
    const [account, category, payee] = [`Club UPI ${run}`, `Fruit ${run}`, `Fresh Fruits ${run}`];
    const karan = await browser.newPage();
    await signInToConsole(karan, '9000000192');
    await karan.getByRole('link', { name: 'Accounts' }).click();
    await karan.getByRole('group', { name: 'Kind' }).getByRole('button', { name: 'UPI' }).click();
    await karan.getByRole('textbox', { name: 'Name' }).fill(account);
    await karan.getByRole('textbox', { name: 'UPI handle, or bank and last four digits' }).fill('rivr@okhdfc');
    await karan.getByRole('button', { name: 'Add account' }).click();
    await expect(karan.getByText('Account added.')).toBeVisible();
    await karan.getByRole('group', { name: 'From', exact: true }).getByRole('button', { name: 'Cash drawer' }).click();
    await karan.getByRole('group', { name: 'To', exact: true }).getByRole('button', { name: account }).click();
    await karan.getByRole('textbox', { name: 'Amount' }).fill('1000');
    await karan.getByRole('button', { name: 'Move money' }).click();
    await expect(karan.getByText(`₹1,000 moved from Cash drawer to ${account}.`)).toBeVisible();
    await karan.getByRole('group', { name: 'Statement for' }).getByRole('button', { name: account }).click();
    await expect(karan.getByRole('table', { name: 'Account statement' }).getByRole('row').filter({ hasText: 'Transfer' })).toContainText('₹1,000');

    await karan.getByRole('link', { name: 'Expenses' }).click();
    await karan.getByRole('textbox', { name: 'New category' }).fill(category);
    await karan.getByRole('button', { name: 'Add category' }).click();
    await karan.getByRole('group', { name: 'Category' }).getByRole('button', { name: category }).click();
    await karan.getByRole('group', { name: 'Paid from' }).getByRole('button', { name: account }).click();
    await karan.getByRole('textbox', { name: 'Amount' }).fill('500');
    await karan.getByRole('textbox', { name: 'Paid to' }).fill(payee);
    await karan.locator('input[type="file"]').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: RECEIPT });
    await expect(karan.getByText('Receipt ready.')).toBeVisible();
    await karan.getByRole('button', { name: 'Ask for approval' }).click();
    await expect(karan.getByText('Sent for approval. A second person approves it before it is paid.')).toBeVisible();
    await expect(karan.getByText('Yours: a second person decides it.').first()).toBeVisible();

    const meher = await browser.newPage();
    await signInToConsole(meher, '9000000193');
    await meher.getByRole('link', { name: 'Expenses' }).click();
    await meher.getByRole('button', { name: `Approve ₹500 to ${payee}` }).click();
    await expect(meher.getByText('Approved by Meher Gill · Asked by Karan Ahuja').first()).toBeVisible();
    await meher.getByRole('button', { name: `Receipt for ${payee}` }).click();
    await expect(meher.getByRole('img', { name: `Receipt for ${payee}` })).toBeVisible();
    await meher.getByRole('link', { name: 'Accounts' }).click();
    await expect(meher.getByRole('table', { name: 'Payment accounts' }).getByRole('row').filter({ hasText: account })).toContainText('₹500');
  });
});
