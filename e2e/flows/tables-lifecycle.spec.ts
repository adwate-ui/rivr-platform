/**
 * Tables come and go (console v3, Phase 6; decision 0432). Priya Nath, this flow's own super admin, adds a table of the
 * run's own on Tables setup, deactivates it (gone from the live floor and every live read, its row kept), reactivates it
 * (back, closed), is refused deleting it while a place waits on its list, then deletes it once the list is empty: setup no
 * longer lists it and its row stays for reports. The rules and refusals are proved in supabase/tests/291_table_lifecycle
 * and @rivr/domain's tableRetireRefusal. Local stack only: it reads and writes the local database.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { openConsole } from '../support/console.ts';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

const CLUB = '00000000-0000-4000-8000-000000000001';
// A name of this run's own, as a table's name is the venue's once, deleted ones included.
const TABLE = `Lifecycle ${Date.now().toString(36).slice(-5)}`;

/** The table's row on Tables setup. */
const rowOf = (page: Page) => page.getByRole('table', { name: 'The club’s tables, in floor order' }).getByRole('row').filter({ hasText: TABLE });

/** Whether the public live read (the website's and TVs' table status) shows the table: 1 or 0. */
const shownLive = () => sql(`select count(*) from public.public_table_status where table_name = '${TABLE}'`);

/** The table's state in the database: active, open and deleted. */
const stateOf = () => sql(`select active || ' ' || is_open || ' ' || (deleted_at is not null) from public.game_table where venue_id = '${CLUB}' and name = '${TABLE}'`);

/** A place waiting on the table's own list, for a member this flow adds; its id. */
function placeOnList(): string {
  const phone = `+9170${String(Date.now()).slice(-8)}`;
  return sql(`with m as (insert into public.member (venue_id, full_name, phone) values ('${CLUB}', 'Lifecycle Waiter', '${phone}') returning id)
    insert into public.waitlist_entry (venue_id, member_id, table_type_id, table_id, idempotency_key)
    select '${CLUB}', m.id, g.table_type_id, g.id, gen_random_uuid() from m, public.game_table g where g.venue_id = '${CLUB}' and g.name = '${TABLE}'
    returning id`).split('\n')[0] ?? '';
}

test.describe('Tables lifecycle', () => {
  test.skip(isRemoteTarget(), 'adds and deletes a table in the local database, so the local stack only');

  test('a super admin deactivates a table, brings it back closed, is refused deleting it while a place waits, then deletes it', async ({ page }) => {
    test.setTimeout(90_000);
    await signInToConsole(page, '9000000176');
    await openConsole(page, '/tables');
    await page.getByRole('button', { name: 'New table' }).click();
    await page.getByRole('textbox', { name: 'Table name' }).fill(TABLE);
    await page.getByRole('radiogroup', { name: 'Stake' }).getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Save the table' }).click();
    await expect(page.getByText(`${TABLE} is saved.`)).toBeVisible();
    await expect(rowOf(page)).toContainText('Active · closed tonight');
    expect(shownLive()).toBe('1');

    // Deactivated: hidden from the floor and everything live, its row kept.
    await page.getByRole('button', { name: `Deactivate ${TABLE}` }).click();
    await expect(page.getByText(`${TABLE} deactivated. Its history stays.`)).toBeVisible();
    await expect(rowOf(page)).toContainText('Inactive · hidden from the floor');
    expect(stateOf()).toBe('false false false');
    expect(shownLive()).toBe('0');

    // Reactivated: back, closed until the floor opens it.
    await page.getByRole('button', { name: `Reactivate ${TABLE}` }).click();
    await expect(page.getByText(`${TABLE} is back, closed.`)).toBeVisible();
    await expect(rowOf(page)).toContainText('Active · closed tonight');
    expect(stateOf()).toBe('true false false');
    expect(shownLive()).toBe('1');

    // A place on its list keeps it: Delete is refused before it is sent.
    const place = placeOnList();
    await page.reload();
    await page.getByRole('button', { name: `Delete ${TABLE}` }).click();
    await expect(page.getByText(`Players wait for ${TABLE}. Take them off its list first.`)).toBeVisible();
    await expect(page.getByRole('button', { name: `Yes, delete ${TABLE}` })).toHaveCount(0);
    expect(stateOf()).toBe('true false false');

    // With the list empty, Delete asks once more, then deletes it for good; its row stays for reports.
    sql(`delete from public.waitlist_entry where id = '${place}'`);
    await page.reload();
    await page.getByRole('button', { name: `Delete ${TABLE}` }).click();
    await page.getByRole('button', { name: `Yes, delete ${TABLE}` }).click();
    await expect(page.getByText(`${TABLE} deleted. Its history stays.`)).toBeVisible();
    await expect(rowOf(page)).toHaveCount(0);
    expect(stateOf()).toBe('false false true');
  });
});
