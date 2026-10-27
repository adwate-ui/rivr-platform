/**
 * The roster (#106; scope-v1 module 10; decision 0236). Ritu Malhotra, an admin and this flow's own roster keeper,
 * rosters every cashier for tonight: an end time that is not HH:MM is refused, then 18:00 to 02:00 goes in. She marks
 * Sana Qureshi late in tonight's attendance, and the roster shows it. She then copies the week into the next one.
 * Overlaps, other job titles, a future shift refused and who sees what are proved in
 * supabase/tests/138_rosters.test.sql. Local stack only: it writes and reads the local database.
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

const RITU = '00000000-0000-4000-8000-000000000184';
const SANA = '00000000-0000-4000-8000-000000000104';
/** The club day now, as the console and record_attendance read it. */
const CLUB_DAY = 'private.club_day_now()';

test.describe('Roster', () => {
  test('Roster: an admin rosters the cashiers tonight, marks one late, and copies the week', async ({ page }) => {
    test.skip(isRemoteTarget(), 'clears its own shifts in the local database, so the local stack only');
    // The shifts an earlier run rostered, so this run does not overlap them.
    sql(`delete from public.staff_attendance a using public.staff_shift h, public.staff s
         where a.shift_id = h.id and s.id = h.created_by_staff_id and s.user_id = '${RITU}'`);
    sql(`delete from public.staff_shift h using public.staff s where s.id = h.created_by_staff_id and s.user_id = '${RITU}'`);

    await signInToConsole(page, '9000000184');
    await page.getByRole('link', { name: 'Roster', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Roster', level: 1 })).toBeVisible();
    const roster = page.getByRole('table', { name: 'The week\'s roster' });

    await page.getByRole('group', { name: 'Job title' }).getByRole('button', { name: 'Cashier', exact: true }).click();
    // The days run from today.
    await page.getByRole('group', { name: 'Days' }).getByRole('button').first().click();
    await page.getByRole('textbox', { name: 'Ends', exact: true }).fill('25:00');
    await page.getByRole('button', { name: 'Add the shifts' }).click();
    await expect(page.getByText('Write the time as HH:MM, such as 18:00.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Ends', exact: true }).fill('02:00');
    await page.getByRole('button', { name: 'Add the shifts' }).click();
    await expect(page.getByText(/^Shifts added: \d+\.$/)).toBeVisible();
    await expect(roster.getByRole('row', { name: /Sana Qureshi/ })).toContainText('18:00–02:00');

    await page.getByRole('group', { name: 'Attendance for Sana Qureshi' }).getByRole('button', { name: 'Late' }).click();
    await expect(roster.getByRole('row', { name: /Sana Qureshi/ })).toContainText('18:00–02:00, Late');
    expect(sql(`select a.status from public.staff_attendance a join public.staff_shift h on h.id = a.shift_id
                join public.staff s on s.id = h.staff_id where s.user_id = '${SANA}' and h.club_day = ${CLUB_DAY}`)).toBe('late');

    await page.getByRole('group', { name: 'Week' }).getByRole('button').nth(1).click();
    await page.getByRole('button', { name: 'Copy the week before into this one' }).click();
    await expect(page.getByText(/^Shifts copied from the week before: \d+\.$/)).toBeVisible();
    await expect(roster.getByRole('row', { name: /Sana Qureshi/ })).toContainText('18:00–02:00');
  });
});
