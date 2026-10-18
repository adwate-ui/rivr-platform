/**
 * KYC review (#31): a check the vendor could not finish waits for staff; a KYC reviewer sees it with
 * what the vendor found and approves it with a reason, and the member is verified. The check is set up
 * in the local database each run (a PAN alone, #198), so the local stack only. Vikram (super admin) is
 * this flow's own reviewer: Auth sends one code a minute to a number.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CLUB = '00000000-0000-4000-8000-000000000001';
const ROHAN = '00000000-0000-4000-8000-000000000204';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

test.describe('KYC review', () => {
  test.skip(isRemoteTarget(), 'sets up the check in the local database, so the local stack only');

  test('a KYC reviewer approves a check waiting for review, with a reason, and the member is verified', async ({ page }) => {
    sql(`delete from public.kyc_record where member_id = '${ROHAN}'`);
    sql(`insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path)
         values ('${CLUB}', '${ROHAN}', 'needs_review', 'pan', '1991-06-15', 'ABCPR4444R', '${CLUB}/${ROHAN}/selfie.jpg')`);

    await signInToConsole(page, '9000000101');
    await page.getByRole('link', { name: 'KYC review' }).click();
    await expect(page.getByRole('heading', { name: 'Waiting for review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rohan Bhatia' })).toBeVisible();
    await expect(page.getByText('ABCPR4444R')).toBeVisible();

    const reason = page.getByRole('textbox', { name: 'Reason for Rohan Bhatia' });
    const check = page.locator('div').filter({ has: reason }).filter({ has: page.getByRole('button', { name: 'Approve' }) }).last();
    await reason.fill('PAN card and the member seen at the desk');
    await check.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByRole('heading', { name: 'Rohan Bhatia' })).toHaveCount(0);
    expect(sql(`select status from public.kyc_record where member_id = '${ROHAN}'`)).toBe('verified');
    expect(sql(`select reason from public.kyc_review where member_id = '${ROHAN}' order by created_at desc limit 1`))
      .toBe('PAN card and the member seen at the desk');
  });
});
