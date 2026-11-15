/**
 * Bonus from a promotion waits for a super admin (decision 0670): Jahnavi Mittal has sat 70 minutes at Table 3 while a
 * play-time promotion pays 500 Bonus after an hour. The step is reached and her Bonus waits: her app shows none. Rohit
 * Chawla, a super admin who signs in to no other flow, approves it under Promotions, Bonus to approve; her app is told
 * "500 Bonus added" and her Bonus shows it. Her own number here: Auth sends one code a minute. The promotion and her seat
 * are set up and taken away in the local database, so the local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const JAHNAVI = '00000000-0000-4000-8000-000000000411';
const CLUB = '00000000-0000-4000-8000-000000000001';
const VISIT = '00000000-0000-4000-8000-0000000e0411';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** This run's promotion: its own name, so an earlier run's Bonus never passes for it. */
const NAME = `Play time ${Date.now().toString(36).slice(-5)}`;

/** Jahnavi with no seat or visit open here, and no play-time promotion of this flow's live. The ledger keeps every grant. */
function reset() {
  sql(`delete from public.seat_session where visit_id = '${VISIT}'`);
  sql(`delete from public.visit where id = '${VISIT}'`);
  sql(`update public.promotion_version set status = 'ended' where venue_id = '${CLUB}' and status = 'live' and name like 'Play time %'`);
  sql(`select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.venue_id = '${CLUB}' and v.name like 'Play time %'`);
}

/** The promotion live since yesterday, 500 after an hour and 1,000 after three; Jahnavi seated 70 minutes ago at a free seat of Table 3. */
function setUp() {
  sql(`with made as (insert into public.promotion (venue_id, name) values ('${CLUB}', '${NAME}') returning id)
       insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
       select '${CLUB}', made.id, 1, 'live', '${NAME}',
              '{"kind": "hours_bonus", "mode": "steps", "steps": [{"afterMinutes": 60, "chips": 500}, {"afterMinutes": 180, "chips": 1000}]}',
              '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
              jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00',
                                 'startsOn', (private.club_day_of(now()) - 1)::text, 'timezone', 'Asia/Kolkata'),
              '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
       from made`);
  sql(`select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.venue_id = '${CLUB}' and v.name = '${NAME}'`);
  sql(`insert into public.visit (id, venue_id, member_id, opened_at) values ('${VISIT}', '${CLUB}', '${JAHNAVI}', now() - interval '75 minutes')`);
  sql(`insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes)
       select '${CLUB}', '${JAHNAVI}', '${VISIT}', g.id,
              (select min(n) from generate_series(1, g.seats) n where not exists (
                 select 1 from public.seat_session s where s.table_id = g.id and s.seat = n and s.ended_at is null)),
              now() - interval '70 minutes', now() - interval '70 minutes', 0
       from public.game_table g where g.venue_id = '${CLUB}' and g.name = 'Table 3'`);
}

/** Jahnavi's Bonus from this run's promotion: its state, or none. */
const grantState = () => sql(`select coalesce((select g.status from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
                                               where g.member_id = '${JAHNAVI}' and p.name = '${NAME}'), 'none')`);
const held = () => Number(sql(`select private.bonus_in_force('${JAHNAVI}', now())`));

test.describe('Bonus to approve', () => {
  test.skip(isRemoteTarget(), 'puts a promotion live and seats a member in the local database, so the local stack only');
  test.beforeEach(reset);
  test.afterEach(reset);

  test('Bonus to approve: a play-time Bonus is reached and waits, the member is shown none; a super admin approves it and the member has it', async ({ browser, page }) => {
    setUp();
    const before = held();
    sql(`select private.weigh_hours_steps('${VISIT}', now())`);
    expect(grantState()).toBe('waiting');

    // Her Bonus shows nothing of it while it waits.
    await signInToPlayer(page, '9000000411', '/bonus');
    await expect(page.getByRole('heading', { name: 'Bonus', level: 1 })).toBeVisible();
    await expect(page.getByText(new RegExp(`^${NAME} · `))).toHaveCount(0);
    expect(held()).toBe(before);

    // A super admin approves it, from the queue under Promotions.
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000113', '/promotions?tab=bonus');
    const queue = admin.getByRole('table', { name: 'Bonus to approve' });
    const row = queue.getByRole('row').filter({ hasText: 'Jahnavi Mittal' }).filter({ hasText: NAME });
    await expect(row).toContainText('1 h played');
    await row.getByRole('button', { name: 'Approve 500 Bonus for Jahnavi Mittal' }).click();
    await expect(admin.getByText('1 approved · 500 Bonus')).toBeVisible();
    await expect(row).toHaveCount(0);
    expect(grantState()).toBe('given');

    // Her app is told, and her Bonus shows it.
    await expect(page.getByText(`500 Bonus added · ${NAME}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(new RegExp(`^${NAME} · `)).first()).toBeVisible();
    expect(held()).toBe(before + 50_000);
  });
});
