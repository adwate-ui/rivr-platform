/**
 * Top-ups only (redesign RD-32; the owner, 15 Nov): Pooja Nair, the seed's guest relations desk, signs in and lands on
 * Top-ups, the one screen on her rail. Dev Khanna, seated at Table 4 (set here in the local database, as the floor's
 * seating and a member's request are proved in call-time.spec.ts), has asked for a top-up: she accepts it and marks it
 * done, and the screen says who took each step and how long it took, tonight and in the day's table. Every other screen
 * refuses her. What the role may read and change in the database is proved in supabase/tests/434_top_ups_only.test.sql.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
const DEV = '00000000-0000-4000-8000-0000000d0756';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Dev off the floor, with no top-up of his left: the flow's own rows, whatever an earlier run left. */
function reset() {
  sql(`delete from public.top_up_request where member_id = '${DEV}'`);
  sql(`delete from public.seat_session where member_id = '${DEV}'`);
  sql(`delete from public.visit where member_id = '${DEV}'`);
}

/** Dev at Table 4, seat 9, for twenty minutes, with a top-up asked for half a minute ago. */
function seatAndAsk() {
  sql(`with v as (insert into public.visit (venue_id, member_id, opened_at) values ('${CLUB}', '${DEV}', now() - interval '25 minutes') returning id),
            s as (insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes, top_up_requested_at)
                  select '${CLUB}', '${DEV}', v.id, g.id, 9, now() - interval '20 minutes', now() - interval '20 minutes', 0, now() - interval '30 seconds'
                  from v, public.game_table g where g.venue_id = '${CLUB}' and g.name = 'Table 4' returning id, table_id)
       insert into public.top_up_request (venue_id, member_id, session_id, table_id, seat, requested_at)
       select '${CLUB}', '${DEV}', s.id, s.table_id, 9, now() - interval '30 seconds' from s`);
}

test.describe('Top-ups only', () => {
  test.skip(isRemoteTarget(), 'seats a member and asks for his top-up in the local database, so the local stack only');
  test.beforeEach(reset);
  test.afterEach(reset);

  test('Top-ups only: guest relations see top-up requests and nothing else, accept one and mark it done, and read who took each step', async ({ page }) => {
    seatAndAsk();
    await signInToConsole(page, '9000000791');
    // Her one screen is where she lands, and the only link on her rail.
    await expect(page.getByRole('heading', { name: 'Top-ups', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/top-ups$/);
    const rail = page.getByRole('navigation', { name: 'Sections' });
    await expect(rail.getByRole('link')).toHaveText([/^Top-ups/]);

    // The request waits with its time counting; she accepts it, then marks it done.
    await expect(page.getByText('Table 4, seat 9 · Dev Khanna')).toBeVisible();
    await page.getByRole('button', { name: 'The top-up for Dev Khanna is in progress' }).click();
    await expect(page.getByText(/^Accepted by Pooja Nair in \d+:\d\d$/)).toBeVisible();
    await page.getByRole('button', { name: 'The top-up for Dev Khanna is done' }).click();
    await expect(page.getByText(/^Done by Pooja Nair in \d+:\d\d$/)).toBeVisible();
    await expect(page.getByText('No top-ups waiting.')).toBeVisible();

    // The day's table, from the server, names her on both steps.
    const row = page.getByRole('table', { name: 'Top-ups of the day' }).getByRole('row').filter({ hasText: 'Dev Khanna' });
    await expect(row).toContainText('Table 4, seat 9');
    await expect(row.getByText('Pooja Nair')).toHaveCount(2);
    await expect(row).toContainText('Done');
    expect(sql(`select outcome || ' ' || (started_by_staff_id = closed_by_staff_id)::text from public.top_up_request where member_id = '${DEV}'`)).toBe('fulfilled true');

    // Every other screen refuses her.
    for (const screen of ['/members', '/waitlist', '/door', '/fnb', '/staff', '/settings', '/requests']) {
      await page.goto(`${appUrl('console')}${screen}`);
      await expect(page.getByText('Not in your role. Ask an admin.')).toBeVisible();
    }
  });
});
