/**
 * Tournament interest (#636). The club publishes a tournament for the day after tomorrow (made here, in the local
 * database, with a name of the run's own). Ajay Dhillon, this flow's own member, sees it under Upcoming tournaments on
 * Home with no buy-in, and registers interest. Leela Pillai, this flow's own admin, finds him on the console's Tournament
 * interest screen and marks him registered once he paid at the club; his Home then says Registered. The rules are
 * proved in supabase/tests/204_tournament_interest.test.sql.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';

/** Runs SQL in this worktree's local database. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

test.describe('Tournament interest', () => {
  test('a member registers interest in an upcoming tournament, and the floor marks him registered', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'publishes a tournament in the local database, so the local stack only');
    test.setTimeout(90_000);
    const name = `Interest Cup ${String(Date.now() % 100_000).padStart(5, '0')}`;
    sql(`insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published)
         values ('${CLUB}', '${name}', now() + interval '2 days', 1000000, true)`);

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000408');
    await expect(member.getByRole('heading', { name: 'Upcoming tournaments' })).toBeVisible();
    await expect(member.getByText(name, { exact: true })).toBeVisible();
    await expect(member.getByText(/₹/)).toHaveCount(0);
    await member.getByRole('button', { name: `Register interest in ${name}` }).click();
    await expect(member.getByText('Pay at the club, and the floor registers you.')).toBeVisible();

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000116');
    await floor.getByRole('link', { name: 'Tournament interest' }).click();
    await expect(floor.getByRole('heading', { name: new RegExp(`^${name} · `) })).toBeVisible();
    await floor.getByRole('button', { name: 'Mark Ajay Dhillon registered' }).first().click();
    await expect(floor.getByText('Registered', { exact: true }).first()).toBeVisible();

    await member.reload();
    await expect(member.getByText(name, { exact: true }).locator('xpath=../..').getByText('Registered', { exact: true })).toBeVisible();
  });
});
