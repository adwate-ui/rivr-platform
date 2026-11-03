/**
 * Promotion simulation (#144; scope-v1 module 7 acceptance; console v3, decisions 0437 and 0465): the floor builds a
 * new Thursday scheme, triple points at the Private Room from 14:00 to 20:00, simulates it on last week as if it had run
 * then, and submits it, in under ten minutes. A member of the flow's own, Simran, played in the Private Room last
 * Thursday 14:00 to 20:00, so the simulation gives twice the points that time earned. Submitting waits for a simulation
 * on the terms as they stand: a change takes it away, and changing back to the terms simulated gives it back. 750 Vikram
 * Bedi, a floor manager, is the flow's own. Local stack only: it writes last week's visit in the local database.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsoleAndWait } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
const NAME = `Thursday triple points ${Date.now().toString(36).slice(-5)}`;

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

// The flow's own member, made once and kept: points records are never removed, so her visit is made once a week.
const SIMRAN = '00000000-0000-4000-8000-0000000002e7';

/**
 * Simran's visit last Thursday, if she has none last week yet: seated in the Private Room 14:00 to 20:00 IST. Its hours
 * are recorded at no points, so no other flow's points or League see it; the schedule's points come from the Private
 * Room's rate, as the engine weighs them.
 */
function playedLastThursday(): void {
  sql(`insert into public.member (id, venue_id, full_name, phone) values ('${SIMRAN}', '${CLUB}', 'Simran Oberoi', '+919000000882')
       on conflict (id) do nothing`);
  // Points by hand only (#629): the club sets no rate. The Private Room earns 20 an hour for last Thursday 14:00 to
  // 20:00 IST alone, so the schedule has points to multiply, and no rate in force now earns any.
  sql(`insert into public.setting (venue_id, key, subject, value, effective_from, reason)
       select '${CLUB}', 'points.per_hour', 'private_room', jsonb_build_object('points', r.points), d + r.at, 'Promotion simulation flow'
       from generate_series(1, 7) n, lateral (select private.tonight_began(now()) - make_interval(days => n) as d) x,
            (values (20, interval '8 hours'), (0, interval '14 hours')) as r (points, at)
       where extract(isodow from d at time zone 'Asia/Kolkata') = 4
       on conflict (venue_id, key, subject, effective_from) do nothing`);
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

/** Last week's Private Room visits whose time inside Thursday 14:00 to 20:00 earned points, and those points: the simulation's basis. */
function lastWeekInSchedule(): { visits: number; points: number } {
  const schedule = `jsonb_build_object('days', '[4]'::jsonb, 'from', '14:00', 'to', '20:00', 'timezone', 'Asia/Kolkata',
    'startsOn', private.club_day_of(private.tonight_began(now()) - interval '7 days'))`;
  const [visits = '0', points = '0'] = sql(`select count(*), coalesce(sum(w.o_points), 0) from public.visit v
    cross join lateral private.visit_schedule_time(v.id, ${schedule}, '{"stakes": ["private_room"], "tiers": "all", "audience": "everyone"}') w
    where v.venue_id = '${CLUB}' and v.closed_at >= private.tonight_began(now()) - interval '7 days' and v.closed_at < private.tonight_began(now())
      and w.o_seconds > 0 and w.o_points > 0`).split('|');
  return { visits: Number(visits), points: Number(points) };
}

test.describe('Promotion simulation', () => {
  test('A new Thursday scheme simulated on last week and submitted in under ten minutes', async ({ page }) => {
    test.skip(isRemoteTarget(), 'writes last week\'s visit in the local database');
    test.setTimeout(120_000);
    playedLastThursday();
    const expected = lastWeekInSchedule();
    expect(expected.visits).toBeGreaterThan(0);

    await signInToConsoleAndWait(page, '9000000750');
    const started = Date.now();
    await page.goto(`${appUrl('console')}/promotions?open=new`);
    await page.getByRole('textbox', { name: 'Name members see' }).fill(NAME);
    await page.getByRole('textbox', { name: 'Multiplier' }).fill('3');
    await page.getByRole('group', { name: 'Stakes' }).getByRole('button', { name: 'Private Room' }).click();
    const days = page.getByRole('group', { name: 'Days' });
    await days.getByRole('button', { name: 'Thu' }).click();
    await days.getByRole('button', { name: 'Fri' }).click();
    await days.getByRole('button', { name: 'Sat' }).click();
    await page.getByRole('textbox', { name: 'From' }).fill('14:00');
    await page.getByRole('textbox', { name: 'To', exact: true }).fill('20:00');
    await expect(page.getByText(/^3× points, for Private Room, Thu 14:00–20:00\. Once per visit per member\./)).toBeVisible();

    // Submitting waits for the simulation.
    const submit = page.getByRole('button', { name: 'Submit for approval' });
    await expect(submit).toBeDisabled();
    await page.getByRole('button', { name: 'Simulate' }).click();
    const figure = (label: string) => page.getByText(label, { exact: true }).locator('xpath=..');
    await expect(figure('times given')).toContainText(expected.visits.toLocaleString('en-IN'), { timeout: 10_000 });
    await expect(figure('extra points')).toContainText((expected.points * 2).toLocaleString('en-IN'));

    // A change takes the simulation away; the terms simulated give it back.
    await page.getByRole('textbox', { name: 'Multiplier' }).fill('2');
    await expect(submit).toBeDisabled();
    await expect(page.getByText('Run it before submitting, so the approver sees what it gives.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Multiplier' }).fill('3');
    await expect(figure('extra points')).toContainText((expected.points * 2).toLocaleString('en-IN'));
    await submit.click();
    await expect(page.getByText(`${NAME} sent for approval`)).toBeVisible({ timeout: 10_000 });
    expect(Date.now() - started).toBeLessThan(10 * 60_000);
    expect(sql(`select status || ' ' || (simulation ->> 'points') from public.promotion_version where name = '${NAME}'`))
      .toBe(`awaiting_approval ${expected.points * 2}`);
  });
});
