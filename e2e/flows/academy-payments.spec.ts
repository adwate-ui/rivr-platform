/**
 * Academy payments (#8, #249): Academy staff open a batch, book a company's heads on it at the corporate
 * fee under its GSTIN and record the UTR the company paid with; a cashier finds that UTR in the bank and
 * confirms it, which pays the booking and issues its invoice, which the company's contact opens in the
 * app. The ledger's split and tax invoices at the club are in pgTAP 089. In the practice venue, so a
 * staging release run leaves nothing in the club and sends nobody a message. Meera (super admin) and Dev
 * (cashier) are this flow's own staff: Auth sends one code a minute to a number. A new batch each run, so a
 * run never meets an earlier one's.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** An ISO day `days` from today. */
function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Signs a staff member in and switches the console to the practice venue. */
async function signInToPractice(page: Page, number: string) {
  await signInToConsole(page, number);
  const rail = page.getByRole('complementary');
  await rail.getByRole('switch', { name: 'Practice venue' }).click();
  await expect(rail.getByText('RIVR Practice')).toBeVisible();
}

test.describe('Academy payments', () => {
  test('staff book a company on a new batch and record its UTR; the cashier confirms it against the bank', async ({ browser }) => {
    const run = String(Date.now()).slice(-6);
    const batchName = `Corporate ${run}`;
    const payer = `Acme ${run}, 2 heads, contact Asha Verma`;
    const utr = String(Date.now()).slice(-12).padStart(12, '6');

    const admin = await browser.newPage();
    await signInToPractice(admin, '9000000102');
    await admin.getByRole('link', { name: 'Academy', exact: true }).click();
    await admin.getByRole('textbox', { name: 'Name', exact: true }).fill(batchName);
    await admin.getByLabel('First day').fill(inDays(40));
    await admin.getByLabel('Last day').fill(inDays(41));
    await admin.getByRole('textbox', { name: 'Seats', exact: true }).fill('10');
    await admin.getByRole('button', { name: 'Open batch' }).click();

    const batch = admin.locator('div')
      .filter({ has: admin.getByRole('heading', { name: batchName }) })
      .filter({ has: admin.getByRole('button', { name: 'Book for a company' }) })
      .last();
    await batch.getByRole('button', { name: 'Book for a company' }).click();
    await admin.getByRole('textbox', { name: 'Contact mobile number', exact: true }).fill('9000000301');
    await admin.getByRole('textbox', { name: 'Company', exact: true }).fill(`Acme ${run}`);
    await admin.getByRole('textbox', { name: 'Heads', exact: true }).fill('2');
    await admin.getByRole('textbox', { name: 'Company GSTIN, if it has one', exact: true }).fill('06AAAAA0000A1Z5');
    await admin.getByRole('button', { name: 'Book', exact: true }).click();
    await expect(admin.getByText(payer, { exact: true })).toBeVisible();
    await expect(batch.getByText('2 of 10 seats booked')).toBeVisible();

    const utrField = admin.getByRole('textbox', { name: `UTR for ${payer}` });
    const booking = admin.locator('div').filter({ has: utrField }).filter({ has: admin.getByRole('button', { name: 'Record UTR' }) }).last();
    await utrField.fill(utr);
    await booking.getByRole('button', { name: 'Record UTR' }).click();
    await expect(admin.getByText(`UTR ${utr}, waiting for the cage.`)).toBeVisible();

    const cashier = await browser.newPage();
    await signInToPractice(cashier, '9000000105');
    await cashier.getByRole('link', { name: 'Academy payments' }).click();
    const payment = cashier.locator('div')
      .filter({ hasText: `UTR ${utr}` })
      .filter({ has: cashier.getByRole('button', { name: 'Found in the bank' }) })
      .last();
    // Two heads at the corporate fee, ₹1,500 each.
    await expect(payment.getByText('₹3,000')).toBeVisible();
    await payment.getByRole('button', { name: 'Found in the bank' }).click();
    await expect(cashier.getByText(`UTR ${utr}`)).toHaveCount(0);

    // Back on Academy, the company's booking is paid: no UTR waiting, nothing left to record.
    await admin.getByRole('link', { name: 'Live floor' }).click();
    await admin.getByRole('link', { name: 'Academy', exact: true }).click();
    await expect(admin.getByText(payer, { exact: true })).toBeVisible();
    await expect(admin.getByText(`UTR ${utr}, waiting for the cage.`)).toHaveCount(0);
    await expect(admin.getByRole('textbox', { name: `UTR for ${payer}` })).toHaveCount(0);

    // The company's contact opens its invoice in the app, under the company's GSTIN, to save as a PDF (#249).
    // A practice booking's invoice is a practice invoice.
    const contact = await browser.newPage();
    await signInToPlayer(contact, '9000000301', '/academy');
    await contact.locator('div').filter({ has: contact.getByRole('heading', { name: batchName }) })
      .getByRole('button', { name: 'Invoice' }).last().click();
    await expect(contact.getByText('Practice invoice, not a tax invoice')).toBeVisible();
    await expect(contact.getByText(`Acme ${run}`)).toBeVisible();
    await expect(contact.getByText('06AAAAA0000A1Z5')).toBeVisible();
    await expect(contact.getByText('₹3,000')).toBeVisible();
    await expect(contact.getByRole('button', { name: 'Save as PDF' })).toBeVisible();
  });
});
