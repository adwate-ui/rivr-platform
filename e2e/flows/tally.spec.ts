/**
 * The Tally export (#96; decision 0187). The flow posts its own club day first: on 1 September 2026,
 * before the club opened, a ₹12,000 sale between two accounts of its own, posted once however often it
 * runs. Pooja Bhatia, an admin, opens Tally, maps the two accounts to Tally ledgers, and saves that day's
 * vouchers as a file. The postings by day and code, who may and the audit log are proved in
 * supabase/tests/120_tally_export.test.sql; the vouchers and the file in @rivr/domain/tally. Local stack
 * only: it posts the day in the local database.
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** The flow's own day: its two accounts, and ₹12,000 from one to the other on 1 September 2026, once. */
function postTheFlowsDay() {
  sql(`insert into public.ledger_account (venue_id, code, name, kind) values
    ('${VENUE}', 'venue.tally_flow_cash', 'Tally flow cash', 'asset'), ('${VENUE}', 'venue.tally_flow_sales', 'Tally flow sales', 'revenue')
    on conflict do nothing`);
  sql(`with posted as (
      insert into public.ledger_transaction (venue_id, kind, idempotency_key, occurred_at)
      values ('${VENUE}', 'sale', 'e2e:tally-flow', '2026-09-01 12:00+05:30') on conflict do nothing returning id
    )
    insert into public.ledger_entry (venue_id, transaction_id, account_id, amount)
    select '${VENUE}', posted.id, a.id, case a.code when 'venue.tally_flow_cash' then 1200000 else -1200000 end
    from posted join public.ledger_account a on a.venue_id = '${VENUE}' and a.member_id is null
      and a.code in ('venue.tally_flow_cash', 'venue.tally_flow_sales')`);
}

async function mapAccount(page: Page, code: string, ledger: string) {
  await page.getByRole('button', { name: `Map: ${code}` }).click();
  await expect(page.getByText(`Account: ${code}`)).toBeVisible();
  await page.getByRole('textbox', { name: 'Tally ledger name' }).fill(ledger);
  await page.getByRole('button', { name: 'Save ledger' }).click();
  await expect(page.getByRole('table', { name: 'Accounts and their Tally ledgers' }).getByRole('row').filter({ hasText: code })).toContainText(ledger);
}

test.describe('Tally', () => {
  test('Tally: an admin maps the accounts and saves a club day\'s vouchers as a file', async ({ page }) => {
    test.skip(isRemoteTarget(), 'posts the flow\'s day in the local database, so the local stack only');
    postTheFlowsDay();
    await signInToConsole(page, '9000000197');
    await page.getByRole('link', { name: 'Tally' }).click();
    await expect(page.getByRole('heading', { name: 'Tally', level: 1 })).toBeVisible();
    await mapAccount(page, 'venue.tally_flow_cash', 'Cash');
    await mapAccount(page, 'venue.tally_flow_sales', 'Sales');

    await page.getByLabel('Club day').fill('2026-09-01');
    await page.getByRole('button', { name: 'Make the file' }).click();
    await expect(page.getByText(/^Vouchers for .+: 1\.$/)).toBeVisible();
    const saved = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download tally-2026-09-01.xml' }).click();
    const file = await saved;
    expect(file.suggestedFilename()).toBe('tally-2026-09-01.xml');
    const xml = await readFile(await file.path(), 'utf8');
    expect(xml).toContain('<DATE>20260901</DATE>');
    expect(xml).toContain('<LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-12000.00</AMOUNT>');
    expect(xml).toContain('<LEDGERNAME>Sales</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>12000.00</AMOUNT>');
  });
});
