/**
 * Purge (#104; additions flow 16): Aarav Saxena, this flow's own super admin (Auth sends one code a minute
 * to a number), runs reset to seed on the practice venue. The
 * dry run lists each table's rows now and in the seed; a name not typed exactly is refused; typed exactly,
 * the venue is back to its seed and every table matches it. The club is never reset (the owner's decision
 * on #104). Earlier flows have played at the practice venue, so there is something to reset.
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

const ROOM = '00000000-0000-4000-8000-0000000000e9';
const IRA = '00000000-0000-4000-8000-000000000186';

/** A throwaway live venue, never the club: Ira its super admin, the owner's backup key, one member, and frozen. */
function makeRoom(): void {
  sql(`select private.bootstrap_venue('${ROOM}', 'E2E Purge Room', 'e2e-purge-room', false, 'E2E Purge Room LLP', 'Gurugram', 'EPR')
       where not exists (select 1 from public.venue where id = '${ROOM}')`);
  sql(`insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
       select '${ROOM}', '${IRA}', 'Ira Bansal', 'Owner', 'super_admin', '+919000000186'
       where not exists (select 1 from public.staff where venue_id = '${ROOM}' and user_id = '${IRA}')`);
  sql(`insert into public.setting (venue_id, key, subject, value, effective_from, reason)
       select '${ROOM}', key, subject, value, '-infinity', 'E2E' from public.setting
       where venue_id = '00000000-0000-4000-8000-000000000001' and key = 'exports.archive_recipient'
         and not exists (select 1 from public.setting where venue_id = '${ROOM}' and key = 'exports.archive_recipient')`);
  sql(`insert into public.member (venue_id, full_name, phone) values ('${ROOM}', 'Purge Test Member', '+919000000995')`);
  sql(`insert into public.control_state (venue_id, level, reason) select '${ROOM}', 'venue_freeze', 'E2E purge'
       where not exists (select 1 from public.control_state where venue_id = '${ROOM}' and level = 'venue_freeze' and released_at is null)`);
}

test.describe('Purge', () => {
  test('Purge: a super admin resets the practice venue to its seed, typing its name', async ({ page }) => {
    test.skip(isRemoteTarget(), 'resets the practice venue, so the local stack only');
    await signInToConsole(page, '9000000177');
    const rail = page.getByRole('complementary');
    await rail.getByRole('switch', { name: 'Practice venue' }).click();
    await expect(rail.getByText('RIVR Practice')).toBeVisible();
    await page.getByRole('link', { name: 'Practice reset' }).click();

    const table = page.getByRole('table', { name: 'Tables a reset reloads' });
    await expect(table.getByRole('cell', { name: 'member', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'staff', exact: true })).toHaveCount(0);

    const name = page.getByRole('textbox', { name: 'Type the venue\'s name to confirm' });
    await name.fill('RIVR practice');
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    await expect(page.getByText('Type the venue\'s name exactly as the rail shows it.')).toBeVisible();

    await name.fill('RIVR Practice');
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    await expect(page.getByText('The practice venue is back to its seed.')).toBeVisible();
    await expect(page.getByText('Every table matches the seed.')).toBeVisible();
  });

  // #432 (decision 0239): Ira Bansal, super admin of a throwaway venue the flow makes, makes and saves the full archive,
  // sees what the purge deletes, types a wrong name, then the right one. The member goes; the audit log keeps the purge.
  // What stays and goes, table by table, is proved in supabase/tests/150_purge_live_venue.test.sql.
  test('Purge: a super admin purges a frozen live venue after saving its archive, typing its name', async ({ page }) => {
    test.skip(isRemoteTarget(), 'makes and purges a venue in the local database, so the local stack only');
    makeRoom();
    await signInToConsole(page, '9000000186');
    await page.getByRole('link', { name: 'Purge', exact: true }).click();

    const saved = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Make the archive' }).click();
    expect((await saved).suggestedFilename()).toMatch(/^rivr-archive-\d{4}-\d{2}-\d{2}\.zip\.age$/);
    await expect.poll(() => sql(`select count(*) from private.export_archive where venue_id = '${ROOM}' and completed_at > now() - interval '5 minutes'`))
      .not.toBe('0');

    const table = page.getByRole('table', { name: 'What the purge deletes' });
    await expect(table.getByRole('row', { name: /^member 1$/ })).toBeVisible();
    const name = page.getByRole('textbox', { name: 'Type the venue\'s name to purge it' });
    await name.fill('E2E purge room');
    await page.getByRole('button', { name: 'Purge the venue' }).click();
    await expect(page.getByText('Type the venue\'s name exactly as it is.')).toBeVisible();
    await name.fill('E2E Purge Room');
    await page.getByRole('button', { name: 'Purge the venue' }).click();
    await expect(page.getByText(/^Purged: [\d,]+ rows deleted\.$/)).toBeVisible();

    expect(sql(`select count(*) from public.member where venue_id = '${ROOM}'`)).toBe('0');
    expect(Number(sql(`select count(*) from public.audit_log where venue_id = '${ROOM}' and action = 'venue.purge' and actor_user_id = '${IRA}'`)))
      .toBeGreaterThan(0);
  });
});
