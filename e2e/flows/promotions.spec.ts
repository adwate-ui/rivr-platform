/**
 * Publish a promotion (console v3, phase 7; decision 0471). Tara Bhalla, a floor manager who manages promotions, starts
 * a new promotion from the Seat bonus template, names it, keeps it to the Private Room every day, simulates it on last
 * week and submits it. Arjun Batra, a super admin and a second person, reviews it and approves it, and it is live:
 * Rhea Sood's Home shows its card, and a seat at the Private Room gives her its 1,000 bonus chips. The sweep pays a seat
 * two minutes after it is taken (decision 0480), so the call the sweep makes stands in for it. 180 Tara,
 * 759 Arjun and 280 Rhea are the flow's own: Auth sends one code a minute to a number. Local stack only: it reads the
 * database and pauses the promotion at the end, so no other flow meets it.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
const RHEA = '00000000-0000-4000-8000-000000000280';
// A name of this run's own, as each run makes a promotion of its own.
const NAME = `Private Room bonus ${Date.now().toString(36).slice(-5)}`;

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/**
 * A seat at the Private Room, as the sweep weighs one past its Undo: what this promotion gave for it, its chips and version.
 * Bonus chips from different promotions stack (decision 0470).
 */
function seatAtThePrivateRoom(memberId: string, key: string): string {
  sql(`select private.evaluate_promotions('${CLUB}', 'seated', jsonb_build_object(
    'member_id', '${memberId}', 'key', 'seated:${key}', 'at', now(),
    'table_id', (select id from public.game_table where venue_id = '${CLUB}' and name = 'Private Room')))`);
  return sql(`select string_agg(g.chips || ' ' || v.version, ', ') from public.promotion_grant g
              join public.promotion_version v on v.id = g.promotion_version_id
              where g.source_key = 'seated:${key}' and g.member_id = '${memberId}' and v.name = '${NAME}'`);
}

/** Builds the promotion from the Seat bonus template, simulates it on last week and submits it. */
async function buildAndSubmit(floor: Page) {
  await floor.goto(`${appUrl('console')}/promotions`);
  await floor.getByRole('button', { name: 'New promotion' }).click();
  await expect(floor.getByRole('heading', { level: 1, name: 'New promotion' })).toBeVisible();
  await floor.getByRole('radiogroup', { name: 'Start from' }).getByRole('radio', { name: 'Seat bonus chips' }).click();
  await floor.getByRole('textbox', { name: 'Name members see' }).fill(NAME);
  await floor.getByRole('group', { name: 'Stakes' }).getByRole('button', { name: 'Private Room' }).click();
  await floor.getByRole('button', { name: 'Every day' }).click();
  await expect(floor.getByText(/^1,000 bonus chips for the first 5 seated at a table, for Private Room, every day, all day\./)).toBeVisible();
  // Submitting waits for a simulation on the terms as they stand.
  await expect(floor.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  await floor.getByRole('button', { name: 'Simulate' }).click();
  await expect(floor.getByText('members qualified', { exact: true })).toBeVisible({ timeout: 10_000 });
  await floor.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(floor.getByText(`${NAME} sent for approval`)).toBeVisible({ timeout: 10_000 });
  const row = floor.getByRole('table', { name: 'Promotions' }).getByRole('row').filter({ hasText: NAME });
  await expect(row).toContainText('Awaiting approval');
}

/** A second staff member, a super admin, reviews it and approves it. */
async function approve(approver: Page) {
  await approver.goto(`${appUrl('console')}/promotions`);
  await approver.getByRole('radio', { name: /^Awaiting approval/ }).click();
  await approver.getByRole('button', { name: `Review ${NAME}` }).click();
  await expect(approver.getByRole('heading', { level: 1, name: `Review: ${NAME}` })).toBeVisible();
  await expect(approver.getByText('A new promotion. Nothing runs yet.')).toBeVisible();
  await approver.getByRole('button', { name: 'Approve' }).click();
  await expect(approver.getByText(`${NAME} is live`)).toBeVisible({ timeout: 10_000 });
}

test.describe('Promotions', () => {
  test.skip(isRemoteTarget(), 'makes a promotion and weighs a seat in the local database, so the local stack only');

  test('create, simulate, submit, approve by a second person, live, and a grant at a seat', async ({ browser }) => {
    test.setTimeout(150_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000180');
    await buildAndSubmit(floor);
    // The one who submitted it never approves it.
    await floor.getByRole('button', { name: `Review ${NAME}` }).click();
    await expect(floor.getByText('A super admin approves it.')).toBeVisible();
    await floor.getByRole('button', { name: 'All promotions' }).click();

    const approver = await browser.newPage();
    await signInToConsole(approver, '9000000759');
    await approve(approver);
    const row = approver.getByRole('table', { name: 'Promotions' }).getByRole('row').filter({ hasText: NAME });
    await approver.getByRole('radio', { name: /^Live/ }).click();
    await expect(row).toContainText('Live');

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000280');
    await expect(member.getByRole('region', { name: 'Offers', exact: true }).getByRole('listitem').filter({ hasText: NAME })).toBeVisible({ timeout: 15_000 });

    // One grant from this promotion, under its version 1: its 1,000 bonus chips.
    expect(seatAtThePrivateRoom(RHEA, `promotions-e2e-${NAME}`)).toBe('1000 1');

    // Paused again, so no other flow meets it.
    await approver.getByRole('button', { name: `Pause ${NAME}` }).click();
    await expect(approver.getByText(`${NAME} paused`)).toBeVisible();
  });
});
