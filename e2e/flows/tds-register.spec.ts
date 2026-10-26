/**
 * TDS and the shareholding register (#93, #97; decisions 0169 and 0170). Simran Gill, a super admin,
 * opens TDS: the withholding ledger by member, then this quarter's return extract, saved as a CSV file.
 * Rehan Kapur, another super admin (Auth sends one code a minute to a number), adds a partner and records
 * a 1% share from today, which the register shows. The ledger's figures, the extract's rows, the 100%
 * rule and who may see what are proved in supabase/tests/099_tds_reports_and_shareholding.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('TDS and the register', () => {
  test('TDS: the ledger by member, and the quarter\'s return extract saved as a file', async ({ page }) => {
    test.skip(isRemoteTarget(), 'takes an audited extract, so the local stack only');
    await signInToConsole(page, '9000000195');
    await page.getByRole('link', { name: 'TDS' }).click();
    await expect(page.getByRole('heading', { name: 'TDS', level: 1 })).toBeVisible();
    // The seed withholds no TDS, so the ledger says so.
    await expect(page.getByText('No TDS in this period.')).toBeVisible();
    await page.getByRole('button', { name: 'Take the extract' }).click();
    await expect(page.getByText(/^\d+ deductions in [A-Z][a-z]{2}–[A-Z][a-z]{2} \d{4}\.$/)).toBeVisible();
    const saved = page.waitForEvent('download');
    await page.getByRole('link', { name: /^Download tds-return-/ }).click();
    expect((await saved).suggestedFilename()).toMatch(/^tds-return-\d{4}-\d{2}-01\.csv$/);
  });

  test('Register: a super admin adds a partner and records his share from today', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes the register, so the local stack only');
    // A partner of this run's own, at 1% and then 0%, so a run again never adds up past 100%.
    const partner = `Partner ${String(Date.now()).slice(-5)}`;
    await signInToConsole(page, '9000000196');
    await page.getByRole('link', { name: 'Shareholders' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill(partner);
    await page.getByRole('button', { name: 'Add shareholder' }).click();
    await expect(page.getByText('Shareholder added.')).toBeVisible();
    await page.getByRole('group', { name: 'Shareholder' }).getByRole('button', { name: partner }).click();
    await page.getByRole('textbox', { name: 'Share (%)' }).fill('1');
    await page.getByRole('button', { name: 'Record holding' }).click();
    await expect(page.getByText('Holding recorded.')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Holdings on the day' }).getByRole('row').filter({ hasText: partner })).toContainText('1%');

    // The same day again at 0% replaces it, so the register stays as it was for the next run.
    await page.getByRole('group', { name: 'Shareholder' }).getByRole('button', { name: partner }).click();
    await page.getByRole('textbox', { name: 'Share (%)' }).fill('0');
    await page.getByRole('button', { name: 'Record holding' }).click();
    await expect(page.getByRole('table', { name: 'Holdings on the day' }).getByRole('row').filter({ hasText: partner })).toContainText('0%');
  });
});
