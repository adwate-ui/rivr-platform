/**
 * Edit a live promotion (console v3, phase 7; decision 0471). Ishita Bose (marketing) publishes a Private Room seat
 * bonus of 1,000, which Leela Varma, a super admin, approves. Ishita then edits it to 500: that makes version 2, which
 * waits for approval while version 1 still runs, so Simran's seat still earns 1,000 under version 1. Leela reads what
 * changed and approves it: version 2 is live, version 1 has ended, and the next seat earns 500 under version 2. The
 * sweep pays a seat two minutes after it is taken (decision 0480), so the call it makes stands in for it. 107 Ishita, 760 Leela and
 * Simran are the flow's own. Local stack only: it reads the database and pauses the promotion at the end.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
// The flow's own member, made once and kept.
const SIMRAN = '00000000-0000-4000-8000-0000000002e7';
const KIRAN = '00000000-0000-4000-8000-0000000002e1';
const NAME = `Private Room versions ${Date.now().toString(36).slice(-5)}`;

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** A seat at the Private Room, as the sweep weighs one past its Undo: the chips given and the version giving them. */
function seated(key: string, memberId = SIMRAN): string {
  sql(`select private.evaluate_promotions('${CLUB}', 'seated', jsonb_build_object('member_id', '${memberId}', 'key', 'seated:${key}', 'at', now(),
    'table_id', (select id from public.game_table where venue_id = '${CLUB}' and name = 'Private Room')))`);
  return sql(`select g.chips || ' ' || v.version from public.promotion_grant g join public.promotion_version v on v.id = g.promotion_version_id
              where g.source_key = 'seated:${key}' and v.name = '${NAME}'`);
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
  test.skip(isRemoteTarget(), 'makes a promotion and weighs seats in the local database, so the local stack only');

  test('editing a live promotion makes version 2, which waits while version 1 still gives, until it is approved', async ({ browser }) => {
    test.setTimeout(150_000);
    sql(`insert into public.member (id, venue_id, full_name, phone) values ('${SIMRAN}', '${CLUB}', 'Simran Oberoi', '+919000000882'), ('${KIRAN}', '${CLUB}', 'Kiran Oberoi', '+919000000883') on conflict (id) do nothing`);
    const author = await browser.newPage();
    await signInToConsole(author, '9000000107');
    await author.goto(`${appUrl('console')}/promotions`);
    await author.getByRole('button', { name: 'New promotion' }).click();
    await author.getByRole('radiogroup', { name: 'Start from' }).getByRole('radio', { name: 'Seat bonus chips' }).click();
    await author.getByRole('textbox', { name: 'Name members see' }).fill(NAME);
    await author.getByRole('group', { name: 'Stakes' }).getByRole('button', { name: 'Private Room' }).click();
    await author.getByRole('button', { name: 'Every day' }).click();
    await simulateAndSubmit(author);
    const approver = await browser.newPage();
    await signInToConsole(approver, '9000000760');
    await approve(approver, 'A new promotion. Nothing runs yet.');

    // Version 2: 500 from 1,000, waiting while version 1 runs.
    await author.goto(`${appUrl('console')}/promotions`);
    await author.getByRole('button', { name: `Edit ${NAME}` }).click();
    await expect(author.getByText('Changes make version 2. Version 1 runs until it is approved.')).toBeVisible();
    await author.getByRole('textbox', { name: 'Bonus chips', exact: true }).fill('500');
    await simulateAndSubmit(author);
    await expect(rowOf(author)).toContainText('Live');
    await expect(rowOf(author)).toContainText('New version awaits approval');
    expect(seated(`versions-e2e-${NAME}-1`)).toBe('1000 1');

    await approve(approver, 'Changes from version 1: reward.');
    await expect(rowOf(approver)).toContainText('Live');
    await expect(rowOf(approver)).not.toContainText('New version awaits approval');
    expect(sql(`select string_agg(version || ' ' || status, ', ' order by version) from public.promotion_version where name = '${NAME}'`))
      .toBe('1 ended, 2 live');
    // Someone else's seat: a member has one of a table's first places a club day (decision 0543).
    expect(seated(`versions-e2e-${NAME}-2`, KIRAN)).toBe('500 2');

    // Paused again, so no other flow meets it.
    await approver.getByRole('button', { name: `Pause ${NAME}` }).click();
    await expect(approver.getByText(`${NAME} paused`)).toBeVisible();
  });
});
