/**
 * Admin tools (owner's feedback doc of 29 Oct). Anjali Nair and Rohit Chawla are super admins and this flow's own (Auth
 * sends one code a minute to a number). Anjali sets up a stake and a table and changes the table's seats (#642), reads
 * the games each club day ran (#643) and builds a time-based bonus in bonus chips (#646). Rohit gives Neha Bhalla locked
 * points, then releases some (#645), which Neha sees on Rewards. Each role's modules are proved in the console's rail tests and
 * supabase/tests/216_role_modules. Local stack only: it reads the database.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

// A name of this run's own, as a table's name is the venue's once.
const RUN = Date.now().toString(36).slice(-5);

test.describe('Admin tools', () => {
  test.skip(isRemoteTarget(), 'adds tables and points and reads them in the local database, so the local stack only');

  test('the super admin sets up a stake and a table, reads the games run, and builds an hours bonus', async ({ page }) => {
    test.setTimeout(90_000);
    await signInToConsole(page, '9000000114');
    await page.getByRole('link', { name: 'Tables setup' }).click();
    await expect(page.getByRole('heading', { name: 'New stake' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Stake name' }).fill(`PLO 200/400 ${RUN}`);
    await page.getByRole('textbox', { name: 'Small blind' }).fill('200');
    await page.getByRole('textbox', { name: 'Big blind' }).fill('400');
    await page.getByRole('textbox', { name: 'Straddle' }).fill('800');
    await page.getByRole('button', { name: 'Save the stake' }).click();
    await expect(page.getByText(`PLO 200/400 ${RUN} is saved.`)).toBeVisible();
    await expect(page.getByRole('table', { name: 'The stakes the club runs' }).getByRole('row').filter({ hasText: `PLO 200/400 ${RUN}` })).toContainText('800');

    await expect(page.getByRole('heading', { name: 'New table' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Table name' }).fill(`Table ${RUN}`);
    await page.getByRole('group', { name: 'Stake' }).getByRole('button', { name: `PLO 200/400 ${RUN}` }).click();
    await page.getByRole('group', { name: 'Seats' }).getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: 'Save the table' }).click();
    await expect(page.getByText(`Table ${RUN} is saved.`)).toBeVisible();
    const tables = page.getByRole('table', { name: 'The club’s tables, in floor order' });
    await expect(tables.getByRole('row').filter({ hasText: `Table ${RUN}` })).toContainText('Closed');
    await tables.getByRole('button', { name: `Change table Table ${RUN}` }).click();
    await page.getByRole('group', { name: 'Seats' }).getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: 'Save the table' }).click();
    await expect(page.getByText(`Table ${RUN} is saved.`)).toBeVisible();
    // No game asked, and the straddle kept (decision 0299).
    expect(sql(`select g.seats || ' ' || coalesce(t.game, 'none') || ' ' || t.big_blind_paise || ' ' || t.straddle_paise
                from public.game_table g join public.table_type t on t.id = g.table_type_id where g.name = 'Table ${RUN}'`)).toBe('6 none 40000 80000');

    // The seed's open tables have run since it was loaded, within the last seven club days.
    await page.getByRole('link', { name: 'Games history' }).click();
    const history = page.getByRole('table', { name: 'Tables run each club day' });
    await expect(history.getByRole('row').filter({ hasText: 'Table 3' }).first()).toBeVisible();
    await page.getByRole('searchbox', { name: 'Find a table' }).fill('Table 3');
    await expect(history.getByRole('row').filter({ hasText: 'Table 1' })).toHaveCount(0);
    await expect(history.getByRole('row').filter({ hasText: 'Table 3' }).first()).toContainText(/\d+ min|\d+ h/);

    // A time-based bonus (#646): 1,500 bonus chips after three hours in a visit.
    await page.getByRole('link', { name: 'Promotions' }).click();
    await page.getByRole('group', { name: 'Reward' }).getByRole('button', { name: 'Bonus chips for hours played' }).click();
    await page.getByRole('textbox', { name: 'Hours played in a visit' }).fill('3');
    await page.getByRole('textbox', { name: 'Bonus chips', exact: true }).fill('1500');
    await expect(page.getByRole('article', { name: 'Bonus chips for hours played' })).toContainText('1,500 bonus chips after 3 hours at the tables');
    await page.getByRole('button', { name: 'Simulate last week' }).click();
    await expect(page.getByText('Times given', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Submit for approval', exact: true }).click();
    await expect(page.getByText('Bonus chips for hours played waits for a super admin to approve it.')).toBeVisible({ timeout: 10_000 });
    expect(sql(`select r.trigger || ' ' || (r.conditions ->> 'min_hours') || ' ' || (r.effect ->> 'amount_paise') from public.promotion_rule r
                join public.promotion p on p.id = r.promotion_id where p.name = 'Bonus chips for hours played' order by p.created_at desc limit 1`))
      .toBe('hours_played 3 150000');
  });

  test('the super admin gives a member locked points and releases some, and the member sees what stays locked', async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000113');
    await admin.getByRole('link', { name: 'Rewards' }).click();
    await admin.getByRole('textbox', { name: 'Member’s mobile number' }).fill('9000000752');
    await admin.getByRole('button', { name: 'Find', exact: true }).click();
    await expect(admin.getByText(/^Neha Bhalla · No\. \d+$/)).toBeVisible();
    await admin.getByRole('textbox', { name: 'Points to give or release' }).fill('300');
    await admin.getByRole('textbox', { name: 'Reason' }).fill('Welcome to RIVR');
    await admin.getByRole('button', { name: 'Give as locked' }).click();
    await expect(admin.getByText('300 points locked for Neha Bhalla.')).toBeVisible();
    await admin.getByRole('textbox', { name: 'Points to give or release' }).fill('100');
    await admin.getByRole('textbox', { name: 'Reason' }).fill('Played the month');
    await admin.getByRole('button', { name: 'Release', exact: true }).click();
    await expect(admin.getByText('100 of Neha Bhalla’s locked points released to spend.')).toBeVisible();

    const neha = await browser.newPage();
    await signInToPlayer(neha, '9000000752', '/rewards');
    await expect(neha.getByText(/^And [\d,]+ locked, for the club to release$/)).toBeVisible();
  });
});
