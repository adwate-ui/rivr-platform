/**
 * The AML register's review (#105; scope-v1 module 12; decision 0234). Meera Pillai, an admin and this flow's own
 * reviewer, opens the register, finds an open entry for 202 Kabir Sethi, and records her review: a note too short is
 * refused, then monitor with a note. The register shows it reviewed, by her, and the audit log keeps the outcome.
 * The entry is written directly here; how cash in makes one with its buy-ins attached, and the limits refusing cash,
 * are proved in supabase/tests/137_aml.test.sql. Local stack only: it writes and reads the local database.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

const CLUB = '00000000-0000-4000-8000-000000000001';
const KABIR = '00000000-0000-4000-8000-000000000202';

test.describe('AML', () => {
  test('AML: an admin reviews a register entry, monitor with a note, and the audit log keeps it', async ({ page }) => {
    test.skip(isRemoteTarget(), 'writes the entry in the local database, so the local stack only');
    // One open entry of a kind a member, as the cage's check would have made it.
    sql(`insert into public.sar_entry (venue_id, member_id, kind) select '${CLUB}', '${KABIR}', 'structuring_visit'
         where not exists (select 1 from public.sar_entry where member_id = '${KABIR}' and kind = 'structuring_visit' and status = 'open')`);

    await signInToConsole(page, '9000000183');
    await page.getByRole('link', { name: 'AML register' }).click();
    const register = page.getByRole('table', { name: 'Register entries' });
    await expect(register).toBeVisible();
    await register.getByRole('button', { name: 'Open Kabir Sethi' }).first().click();

    await page.getByRole('group', { name: 'Outcome' }).getByRole('button', { name: 'Monitor' }).click();
    await page.getByRole('textbox', { name: 'Note' }).fill('Short');
    await page.getByRole('button', { name: 'Record the review' }).click();
    await expect(page.getByText('Choose an outcome and write a note of 10 to 1,000 characters.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Note' }).fill('Watching his cash buy-ins for a month');
    await page.getByRole('button', { name: 'Record the review' }).click();
    await expect(page.getByText('Reviewed by Meera Pillai: Monitor.')).toBeVisible();

    const reviewed = sql(`select e.outcome || ' ' || (select count(*) from public.audit_log a where a.entity = 'sar_entry' and a.entity_id = e.id::text
                          and a.action = 'aml.review') from public.sar_entry e where e.member_id = '${KABIR}' and e.reviewed_at is not null
                          order by e.reviewed_at desc limit 1`);
    expect(reviewed).toBe('monitor 1');
  });
});
