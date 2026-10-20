/**
 * Buy-in with the Tuesday bonus (#88; design prompt flow 3). The seed runs the design prompt's Buy-in
 * bonus Tuesday: 20% of each of the first five buy-ins at a table on a Tuesday club day, as bonus; the
 * flow makes today its day, and puts Tuesday back at the end. Dev Arora,
 * this flow's own duty manager, seats Kiran Joshi at Table 3, seat 7, and issues her ₹10,000 of chips
 * from her wallet at the cage: her Balance drops by ₹10,000 and ₹2,000 of bonus is credited. Five more
 * follow: the second to the fifth at Table 3 each earn ₹2,000, the sixth none. 181 and 281 are the
 * flow's own (Auth sends one code a minute to a number). Local stack only: it sets the day and reads the
 * buy-ins in the local database, and expects a fresh stack (pnpm db:reset), where no flow before it buys
 * in at Table 3.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const KIRAN = '00000000-0000-4000-8000-000000000281';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Sets the days the club's Tuesday bonus runs on: a JSON array of ISO weekdays, as SQL. */
function setTuesdayBonusDays(days: string) {
  sql(`update public.promotion_rule r set conditions = jsonb_set(r.conditions, '{days}', ${days}) from public.promotion p
    where p.id = r.promotion_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'tuesday_bonus'`);
}

/** How many times the club's Tuesday bonus was given at Table 3 this club day. */
function tuesdayBonusesAtTable3(): number {
  return Number(sql(`select count(*) from public.promotion_grant g join public.promotion p on p.id = g.promotion_id
    join public.game_table t on t.id = g.table_id
    where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.template_key = 'tuesday_bonus' and t.name = 'Table 3'
      and g.club_day = (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date`));
}

/** Issues ₹10,000 of chips to Kiran from her wallet, and waits until it is her nth buy-in. */
async function issueFromWallet(floor: Page, nth: number) {
  await floor.getByRole('textbox', { name: 'Amount', exact: true }).fill('10000');
  await floor.getByRole('button', { name: 'Issue chips' }).click();
  await expect.poll(() => Number(sql(`select count(*) from public.cage_transaction where member_id = '${KIRAN}'`))).toBe(nth);
  await expect(floor.getByText('₹10,000 of chips issued.')).toBeVisible();
}

/** Kiran's Balance: her wallet cash, and a line for each ₹2,000 bonus she holds. */
async function seesBalance(member: Page, cash: string, bonuses: number) {
  await member.reload();
  await expect(member.getByRole('heading', { name: 'Balance', level: 1 })).toBeVisible();
  await expect(member.getByText(cash, { exact: true })).toBeVisible();
  await expect(member.getByText(/^₹2,000 bonus · expires /)).toHaveCount(bonuses);
}

/** Flow 3 and five more buy-ins at Table 3: ₹2,000 of bonus for each of the first five, none for the sixth. */
async function buysInSixTimes(browser: Browser) {
  const floor = await browser.newPage();
  await signInToConsole(floor, '9000000181');
  await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
  await floor.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '7', exact: true }).click();
  await floor.getByRole('textbox', { name: 'Mobile number' }).fill('9000000281');
  await floor.getByRole('button', { name: 'Seat', exact: true }).click();
  await expect(floor.getByRole('button', { name: 'Move Kiran Joshi' })).toBeVisible();

  await floor.getByRole('link', { name: 'Cage' }).click();
  await floor.getByRole('textbox', { name: 'Search members' }).fill('Kiran');
  await floor.getByRole('button', { name: 'Kiran Joshi' }).click();
  await expect(floor.getByText(/KYC verified · Table 3, seat 7$/)).toBeVisible();
  await floor.getByRole('group', { name: 'Pay by' }).getByRole('button', { name: 'Wallet' }).click();
  await issueFromWallet(floor, 1);

  const member = await browser.newPage();
  await signInToPlayer(member, '9000000281');
  await member.getByRole('link', { name: 'Balance' }).click();
  await seesBalance(member, '₹90,000', 1);

  for (const nth of [2, 3, 4, 5, 6]) await issueFromWallet(floor, nth);
  expect(tuesdayBonusesAtTable3(), 'five at Table 3, and none for the sixth').toBe(5);
  await seesBalance(member, '₹40,000', 5);
}

test.describe('Buy-in bonus', () => {
  test('Buy-in with the Tuesday bonus: a ₹10,000 buy-in among the first five at Table 3 credits ₹2,000 bonus; the sixth does not', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'seats a member, issues chips and reads the database, so the local stack only');
    test.setTimeout(120_000);
    expect(tuesdayBonusesAtTable3(), 'no Tuesday bonus at Table 3 yet today: run pnpm db:reset first').toBe(0);
    // Today is Tuesday here: the club day, 06:00 to 06:00 IST, as the engine reads it.
    setTuesdayBonusDays(`jsonb_build_array(extract(isodow from now() at time zone 'Asia/Kolkata' - interval '6 hours')::integer)`);
    try {
      await buysInSixTimes(browser);
    } finally {
      setTuesdayBonusDays(`'[2]'::jsonb`);
    }
  });
});
