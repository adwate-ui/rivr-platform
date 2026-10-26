/**
 * The monthly partner and investor statements (#98; decision 0189). Kiara Sethi, a super admin, adds a
 * partner of this run's own and records a 1% holding from 1 January 2026, then opens last month's
 * statements: the partner is there at 1%, and their statement opens with Save as PDF. The holding goes
 * back to 0% at the end, so a run again never adds up past 100%. The share is proved on
 * packages/testing/golden/holderShare.json, the month's figures in supabase/tests/121_reports_and_mis.test.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

async function recordHolding(page: Page, partner: string, percent: string) {
  await page.getByRole('group', { name: 'Shareholder' }).getByRole('button', { name: partner }).click();
  await page.getByRole('textbox', { name: 'Share (%)' }).fill(percent);
  await page.getByLabel('From').fill('2026-01-01');
  await page.getByRole('button', { name: 'Record holding' }).click();
  await expect(page.getByText('Holding recorded.')).toBeVisible();
}

test.describe('Statements', () => {
  test('Statements: a super admin opens a partner\'s statement for last month', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes the register, so the local stack only');
    const partner = `Statement partner ${String(Date.now()).slice(-5)}`;
    await signInToConsole(page, '9000000199');
    await page.getByRole('link', { name: 'Shareholders' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill(partner);
    await page.getByRole('button', { name: 'Add shareholder' }).click();
    await expect(page.getByText('Shareholder added.')).toBeVisible();
    await recordHolding(page, partner, '1');

    const holders = page.getByRole('table', { name: 'Holders and their share of the month' });
    await expect(holders.getByRole('row').filter({ hasText: partner })).toContainText('1%');
    await page.getByRole('button', { name: `Statement: ${partner}` }).click();
    await expect(page.getByRole('heading', { name: 'Partner statement' })).toBeVisible();
    await expect(page.getByText('Share at 1%')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save as PDF' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(holders).toBeVisible();

    await recordHolding(page, partner, '0');
  });
});
