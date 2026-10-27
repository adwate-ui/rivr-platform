/**
 * Promotion simulation (#144; scope-v1 module 7 acceptance): the floor builds a new Thursday scheme,
 * Thursday 14:00 to 20:00 in the Private Room, triple points, simulates it on last week and publishes it,
 * in under ten minutes. A member of the flow's own, Simran, played in the Private Room last Thursday 14:00
 * to 20:00, so the simulation gives twice the points that time earned, at no rupee cost and no cap.
 * Publishing waits for a simulation of the choices as they stand. 107 Ishita (marketing, who manage
 * promotions) is the flow's own. Local stack only: it writes last week's visit in the local database.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
const WINDOW = '{"days": [4], "from": "14:00", "until": "20:00", "stakes": ["private_room"]}';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

// The flow's own member, made once and kept: points records are never removed, so her visit is made once a week.
const SIMRAN = '00000000-0000-4000-8000-0000000002e7';

/**
 * Simran's visit last Thursday, if she has none last week yet: seated in the Private Room 14:00 to 20:00 IST.
 * Its hours are recorded at no points, so no other flow's points or League see it; the window's points come
 * from the Private Room's rate, as the engine weighs them.
 */
function playedLastThursday(): void {
  sql(`insert into public.member (id, venue_id, full_name, phone) values ('${SIMRAN}', '${CLUB}', 'Simran Oberoi', '+919000000882')
       on conflict (id) do nothing`);
  sql(`with thursday as (
         select d from generate_series(1, 7) n, lateral (select private.tonight_began(now()) - make_interval(days => n) as d) x
         where extract(isodow from d at time zone 'Asia/Kolkata') = 4
           and not exists (select 1 from public.visit v where v.member_id = '${SIMRAN}' and v.closed_at >= private.tonight_began(now()) - interval '7 days')),
       room as (select id from public.game_table where venue_id = '${CLUB}' and name = 'Private Room'),
       visit as (insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
                 select '${CLUB}', '${SIMRAN}', d + interval '8 hours', d + interval '14 hours 30 minutes', 'cash_out' from thursday returning id, opened_at),
       session as (insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
                   select '${CLUB}', '${SIMRAN}', visit.id, room.id, 9, visit.opened_at, visit.opened_at, visit.opened_at + interval '6 hours', 'cash_out'
                   from visit, room returning id, visit_id)
       insert into public.points_earning (venue_id, member_id, visit_id, basis, session_id, table_id, played_seconds, rate, points)
       select '${CLUB}', '${SIMRAN}', session.visit_id, 'hours', session.id, room.id, 21600, 0, 0 from session, room`);
}

/** Last week's Private Room visits whose time inside the window earned points, and those points: the simulation's basis. */
function lastWeekInWindow(): { visits: number; points: number } {
  const [visits = '0', points = '0'] = sql(`select count(*), coalesce(sum(w.o_points), 0) from public.visit v
    cross join lateral private.visit_window_time(v.id, '${WINDOW}') w
    where v.venue_id = '${CLUB}' and v.closed_at >= private.tonight_began(now()) - interval '7 days' and v.closed_at < private.tonight_began(now())
      and (select h.o_played from private.visit_hours(v.id) h) > 0 and w.o_points > 0`).split('|');
  return { visits: Number(visits), points: Number(points) };
}

test.describe('Promotion simulation', () => {
  test('A new Thursday scheme simulated on last week and published in under ten minutes', async ({ page }) => {
    test.skip(isRemoteTarget(), 'writes last week\'s visit in the local database');
    test.setTimeout(120_000);
    playedLastThursday();
    const expected = lastWeekInWindow();
    expect(expected.visits).toBeGreaterThan(0);

    await signInToConsole(page, '9000000107');
    const started = Date.now();
    await page.getByRole('link', { name: 'Promotions' }).click();
    await expect(page.getByRole('heading', { name: 'New promotion' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('group', { name: 'Days' }).getByRole('button', { name: 'Thursday' }).click();
    await page.getByRole('group', { name: 'From' }).getByRole('button', { name: '14:00' }).click();
    await page.getByRole('group', { name: 'To' }).getByRole('button', { name: '20:00' }).click();
    await page.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'Private Room' }).click();
    await page.getByRole('group', { name: 'Reward' }).getByRole('button', { name: 'Triple points' }).click();

    // Publishing waits for the simulation.
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await expect(page.getByText('Simulate it on last week before publishing.')).toBeVisible();
    await page.getByRole('button', { name: 'Simulate last week' }).click();
    const figure = (label: string, value: string) => page.getByText(label, { exact: true }).locator('xpath=..').getByText(value, { exact: true });
    await expect(figure('Times given', expected.visits.toLocaleString('en-IN'))).toBeVisible({ timeout: 10_000 });
    await expect(figure('Extra points', (expected.points * 2).toLocaleString('en-IN'))).toBeVisible();
    await expect(figure('Bonus cost', '₹0')).toBeVisible();
    await expect(figure('Budget', 'No cap')).toBeVisible();

    // A change clears the simulation; simulating again lets it publish.
    await page.getByRole('group', { name: 'Reward' }).getByRole('button', { name: 'Double points' }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
    await page.getByRole('group', { name: 'Reward' }).getByRole('button', { name: 'Triple points' }).click();
    await page.getByRole('button', { name: 'Simulate last week' }).click();
    await expect(figure('Extra points', (expected.points * 2).toLocaleString('en-IN'))).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Triple points is live.')).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - started).toBeLessThan(10 * 60_000);

    // Paused again, so no other flow meets it.
    const running = page.getByText('Private Room · Thursday, 14:00 to 20:00', { exact: true }).first().locator('xpath=../..');
    await running.getByRole('button', { name: 'Pause' }).click();
    await expect(running.getByText('Paused', { exact: true })).toBeVisible();
  });
});
