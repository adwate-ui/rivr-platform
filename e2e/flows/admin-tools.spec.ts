/**
 * Admin tools (owner's feedback doc of 29 Oct). Anjali Nair is a super admin and this flow's own (Auth
 * sends one code a minute to a number). She sets up a stake and a table and changes the table's seats (#642), reads
 * the games each club day ran (#643) and builds a time-based bonus in bonus chips (#646). Each role's modules are proved in the console's rail tests and
 * supabase/tests/216_role_modules. Local stack only: it reads the database.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { openConsole } from '../support/console.ts';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

// A name of this run's own, as a table's name is the venue's once. Its table is "Setup …", never "Table …": "Table 51esg"
// once made another flow's "Settings for Table 5" match two tables on the floor.
const RUN = Date.now().toString(36).slice(-5);

test.describe('Admin tools', () => {
  test.skip(isRemoteTarget(), 'adds tables and reads them in the local database, so the local stack only');

  test('the super admin sets up a stake and a table, and builds an hours bonus', async ({ page }) => {
    test.setTimeout(90_000);
    await signInToConsole(page, '9000000114');
    await openConsole(page, '/tables');
    // A stake, in the panel at the side (redesign RD-17): its blinds, straddle and the call time it is given.
    await page.getByRole('button', { name: 'New stake' }).click();
    const stakePanel = page.getByRole('dialog', { name: 'New stake' });
    await stakePanel.getByRole('textbox', { name: 'Stake name' }).fill(`PLO 200/400 ${RUN}`);
    await stakePanel.getByRole('textbox', { name: 'Small blind' }).fill('200');
    await stakePanel.getByRole('textbox', { name: 'Big blind' }).fill('400');
    await stakePanel.getByRole('textbox', { name: 'Straddle' }).fill('800');
    await stakePanel.getByRole('textbox', { name: 'Call time' }).fill('240');
    await stakePanel.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(`PLO 200/400 ${RUN} added.`)).toBeVisible();
    await expect(stakePanel).toBeHidden();
    // Written with its straddle, and with its call time.
    const stake = page.getByRole('table', { name: 'The stakes the club runs' }).getByRole('row').filter({ hasText: `PLO 200/400 ${RUN}` });
    await expect(stake).toContainText('200/400/800');
    await expect(stake).toContainText('4 h');

    // A table of it: the minimum buy-in comes filled in at 50 big blinds, ₹20,000, and the admin types their own.
    await page.getByRole('button', { name: 'New table' }).click();
    const tablePanel = page.getByRole('dialog', { name: 'New table' });
    await tablePanel.getByRole('textbox', { name: 'Table name' }).fill(`Setup ${RUN}`);
    await tablePanel.getByRole('radiogroup', { name: 'Stake' }).getByRole('radio', { name: `PLO 200/400 ${RUN}` }).click();
    await expect(tablePanel.getByRole('textbox', { name: 'Minimum buy-in' })).toHaveValue('20000');
    await tablePanel.getByRole('radiogroup', { name: 'Seats' }).getByRole('radio', { name: '8', exact: true }).click();
    await tablePanel.getByRole('textbox', { name: 'Minimum buy-in' }).fill('25000');
    await tablePanel.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(`Setup ${RUN} added, closed.`)).toBeVisible();
    const tables = page.getByRole('table', { name: 'The club’s tables, in floor order' });
    await expect(tables.getByRole('row').filter({ hasText: `Setup ${RUN}` })).toContainText('Closed tonight');
    await expect(tables.getByRole('row').filter({ hasText: `Setup ${RUN}` })).toContainText('₹25,000');
    await tables.getByRole('button', { name: `Change table Setup ${RUN}` }).click();
    const changePanel = page.getByRole('dialog', { name: `Change table Setup ${RUN}` });
    await changePanel.getByRole('radiogroup', { name: 'Seats' }).getByRole('radio', { name: '6', exact: true }).click();
    await changePanel.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(`Setup ${RUN} saved.`)).toBeVisible();
    // No game asked, the straddle kept (decision 0299); the table's own minimum and the stake's call time (redesign RD-16).
    expect(sql(`select g.seats || ' ' || coalesce(t.game, 'none') || ' ' || t.big_blind_paise || ' ' || t.straddle_paise || ' ' || g.min_buy_in_paise || ' ' ||
                       (select s.value ->> 'minutes' from public.setting s where s.venue_id = t.venue_id and s.key = 'call_time.minutes' and s.subject = t.code)
                from public.game_table g join public.table_type t on t.id = g.table_type_id where g.name = 'Setup ${RUN}'`)).toBe('6 none 40000 80000 2500000 240');

    // A time-based bonus (#646): 1,500 bonus chips after three hours in a visit, built as a version (console v3, decision 0471).
    await page.goto(`${appUrl('console')}/promotions?open=new`);
    await page.getByRole('radiogroup', { name: 'Reward' }).getByRole('radio', { name: 'Hours played' }).click();
    await page.getByRole('textbox', { name: 'Name members see' }).fill(`Hours bonus ${RUN}`);
    await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('1500');
    await page.getByRole('textbox', { name: 'After', exact: true }).fill('3');
    await expect(page.getByText(/^1,500 Bonus after 3 hours, for all stakes/)).toBeVisible();
    await page.getByRole('button', { name: 'Simulate' }).click();
    await expect(page.getByText('times given', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.getByText(`Hours bonus ${RUN} sent for approval`)).toBeVisible({ timeout: 10_000 });
    expect(sql(`select (reward ->> 'chips') || ' ' || (reward ->> 'afterMinutes') || ' ' || status from public.promotion_version
                where name = 'Hours bonus ${RUN}'`)).toBe('1500 180 awaiting_approval');
  });

});
