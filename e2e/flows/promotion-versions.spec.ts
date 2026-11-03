/**
 * Edit a live promotion (console v3, phase 7; decision 0437). Ishita Bose (marketing) publishes a Private Room buy-in
 * bonus of 20%, which Leela Varma, a super admin, approves. Ishita then edits it to 10%: that makes version 2, which
 * waits for approval while version 1 still runs, so Simran's buy-in still earns 20% under version 1. Leela reads what
 * changed and approves it: version 2 is live, version 1 has ended, and the next buy-in earns 10% under version 2. The
 * console takes no buy-ins (decision 0284), so the cage's own trigger call stands in for one. 107 Ishita, 760 Leela and
 * Simran are the flow's own. Local stack only: it reads the database and pauses the promotion at the end.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsoleAndWait } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
// The flow's own member, made once and kept.
const SIMRAN = '00000000-0000-4000-8000-0000000002e7';
const NAME = `Private Room versions ${Date.now().toString(36).slice(-5)}`;

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** A buy-in of 10,000 in cash at the Private Room, as the cage's trigger weighs one: the chips given and the version giving them. */
function buyIn(key: string): string {
  sql(`select private.evaluate_promotions('${CLUB}', 'buy_in', jsonb_build_object('member_id', '${SIMRAN}', 'key', 'buy_in:${key}',
    'amount_paise', 1000000, 'method', 'cash', 'table_id', (select id from public.game_table where venue_id = '${CLUB}' and name = 'Private Room')))`);
  return sql(`select g.chips || ' ' || v.version from public.promotion_grant g join public.promotion_version v on v.id = g.promotion_version_id
              where g.source_key = 'buy_in:${key}' and v.name = '${NAME}'`);
}

/** The list's row for the promotion. */
const rowOf = (page: Page) => page.getByRole('table', { name: 'Promotions' }).getByRole('row').filter({ hasText: NAME });

/** Ishita sets the bonus and simulates it on last week, then submits it for approval. */
async function simulateAndSubmit(author: Page) {
  await author.getByRole('button', { name: 'Simulate' }).click();
  await expect(author.getByText('members qualified', { exact: true })).toBeVisible({ timeout: 10_000 });
  await author.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(author.getByText(`${NAME} sent for approval`)).toBeVisible({ timeout: 10_000 });
}

/** Leela reviews the waiting version and approves it. */
async function approve(approver: Page, changes: string) {
  await approver.goto(`${appUrl('console')}/promotions`);
  await approver.getByRole('button', { name: `Review ${NAME}` }).click();
  await expect(approver.getByText(changes)).toBeVisible();
  await approver.getByRole('button', { name: 'Approve' }).click();
  await expect(approver.getByText(`${NAME} is live`)).toBeVisible({ timeout: 10_000 });
}

test.describe('Promotion versions', () => {
  test.skip(isRemoteTarget(), 'makes a promotion and weighs buy-ins in the local database, so the local stack only');

  test('editing a live promotion makes version 2, which waits while version 1 still gives, until it is approved', async ({ browser }) => {
    test.setTimeout(150_000);
    sql(`insert into public.member (id, venue_id, full_name, phone) values ('${SIMRAN}', '${CLUB}', 'Simran Oberoi', '+919000000882') on conflict (id) do nothing`);
    const author = await browser.newPage();
    await signInToConsoleAndWait(author, '9000000107');
    await author.goto(`${appUrl('console')}/promotions`);
    await author.getByRole('button', { name: 'New promotion' }).click();
    await author.getByRole('radiogroup', { name: 'Start from' }).getByRole('radio', { name: 'Buy-in bonus' }).click();
    await author.getByRole('textbox', { name: 'Name members see' }).fill(NAME);
    await author.getByRole('group', { name: 'Stakes' }).getByRole('button', { name: 'Private Room' }).click();
    await author.getByRole('button', { name: 'Every day' }).click();
    await simulateAndSubmit(author);
    const approver = await browser.newPage();
    await signInToConsoleAndWait(approver, '9000000760');
    await approve(approver, 'A new promotion. Nothing runs yet.');

    // Version 2: 10% from 20%, waiting while version 1 runs.
    await author.goto(`${appUrl('console')}/promotions`);
    await author.getByRole('button', { name: `Edit ${NAME}` }).click();
    await expect(author.getByText('Changes make version 2. Version 1 runs until it is approved.')).toBeVisible();
    await author.getByRole('textbox', { name: 'Bonus', exact: true }).fill('10');
    await simulateAndSubmit(author);
    await expect(rowOf(author)).toContainText('Live');
    await expect(rowOf(author)).toContainText('New version awaits approval');
    expect(buyIn(`versions-e2e-${NAME}-1`)).toBe('2000 1');

    await approve(approver, 'Changes from version 1: reward.');
    await expect(rowOf(approver)).toContainText('Live');
    await expect(rowOf(approver)).not.toContainText('New version awaits approval');
    expect(sql(`select string_agg(version || ' ' || status, ', ' order by version) from public.promotion_version where name = '${NAME}'`))
      .toBe('1 ended, 2 live');
    expect(buyIn(`versions-e2e-${NAME}-2`)).toBe('1000 2');

    // Paused again, so no other flow meets it.
    await approver.getByRole('button', { name: `Pause ${NAME}` }).click();
    await expect(approver.getByText(`${NAME} paused`)).toBeVisible();
  });
});
