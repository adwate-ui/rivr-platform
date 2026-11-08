/**
 * ID checks (#31): checks the vendor could not finish wait for staff; a KYC reviewer sees each with why
 * it waits and what the vendor found, approves one and rejects another with a reason, and the rejected
 * one moves to the refused checks. The checks are set up in the local database for each run and taken
 * away after, so the local stack only. Vikram (super admin) is this flow's own reviewer: Auth sends one
 * code a minute to a number.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
const ROHAN = '00000000-0000-4000-8000-000000000204';
const NAINA = '00000000-0000-4000-8000-000000000203';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

function removeChecks() {
  sql(`delete from public.kyc_review where member_id in ('${ROHAN}', '${NAINA}')`);
  sql(`delete from public.kyc_record where member_id in ('${ROHAN}', '${NAINA}')`);
}

/** One check waiting for review: a PAN alone, as #198 sends it. */
function waitingCheck(member: string, pan: string) {
  sql(`insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path)
       values ('${CLUB}', '${member}', 'needs_review', 'pan', '1991-06-15', '${pan}', '${CLUB}/${member}/selfie.jpg')`);
}

/** Decides one member's check from the queue, with the reason. */
async function decide(page: Page, name: string, reason: string, decision: 'Approve' | 'Reject') {
  const field = page.getByRole('textbox', { name: `Reason for ${name}` });
  const check = page.locator('div').filter({ has: field }).filter({ has: page.getByRole('button', { name: decision }) }).last();
  await field.fill(reason);
  await check.getByRole('button', { name: decision }).click();
}

test.describe('ID checks', () => {
  test.skip(isRemoteTarget(), 'sets up the checks in the local database, so the local stack only');
  test.beforeEach(() => {
    removeChecks();
    waitingCheck(ROHAN, 'ABCPR4444R');
    waitingCheck(NAINA, 'ABCPN4444N');
  });
  test.afterEach(removeChecks);

  test('a KYC reviewer approves one check and rejects another, each with a reason', async ({ page }) => {
    await signInToConsole(page, '9000000101');
    await page.getByRole('link', { name: 'ID checks', exact: true }).click();
    // The queue down the left, the first check to review open beside it (console v3).
    await expect(page.getByRole('heading', { name: 'To review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rohan Bhatia' })).toBeVisible();
    await expect(page.getByText('ABCPR4444R')).toBeVisible();
    await expect(page.getByText('PAN only, no DigiLocker. Check the card and the person.').first()).toBeVisible();

    await decide(page, 'Rohan Bhatia', 'PAN card and the member seen at the desk', 'Approve');
    await expect(page.getByRole('heading', { name: 'Rohan Bhatia' })).toHaveCount(0);
    expect(sql(`select status from public.kyc_record where member_id = '${ROHAN}'`)).toBe('verified');

    // Rohan has left the queue, so Naina's check is open now.
    await decide(page, 'Naina Kapoor', 'The person at the desk is not the one in the photo', 'Reject');
    await expect(page.getByRole('heading', { name: 'Refused, last 90 days' })).toBeVisible();
    await expect(page.getByText('Rejected by a reviewer.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'ID check photo of Naina Kapoor' }).or(page.getByText(/^Photo not loaded/))).toBeVisible();
    expect(sql(`select status || ' ' || refusal from public.kyc_record where member_id = '${NAINA}'`)).toBe('refused staff_rejected');
  });
});
