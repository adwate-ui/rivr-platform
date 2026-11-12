/**
 * An admin who is also a member (production, 12 Nov): their login can read every member's ID check (kyc.review), and the
 * app took all of them for the member's own, so it stayed on its loading screen. A member with no check yet goes to the
 * selfie, whatever else their login can read. Charu is made an admin for the flow and back again, so the local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

// Charu Bedi (supabase/seed/15_players_more.sql): a member with the app and no ID check, whose number no other flow uses.
const CHARU = '+919000000407';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

function removeAdmin() {
  sql(`delete from public.staff where phone = '${CHARU}'`);
}

test.describe('An admin who is also a member', () => {
  test.skip(isRemoteTarget(), 'makes a member an admin in the local database, so the local stack only');
  test.beforeEach(() => {
    removeAdmin();
    sql(`insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
         select venue_id, user_id, full_name, 'Manager', 'admin', phone from public.member where phone = '${CHARU}'`);
  });
  test.afterEach(removeAdmin);

  test('is sent to their own ID check, though their login can read every member\'s', async ({ page }) => {
    await signInToPlayer(page, '9000000407', '/kyc');
    await expect(page.getByRole('button', { name: 'Take a selfie' })).toBeVisible();

    // Opened at Tonight, as on 12 Nov, the app sends them on to the selfie rather than loading for ever.
    await page.goto(`${appUrl('player')}/`);
    await expect(page).toHaveURL(/\/kyc$/);
    await expect(page.getByRole('button', { name: 'Take a selfie' })).toBeVisible();
  });
});
