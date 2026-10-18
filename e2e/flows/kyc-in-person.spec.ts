/**
 * Manual KYC (#246): while no KYC vendor is live, a KYC reviewer checks a member in person at the
 * club. Rhea (membership manager) finds Kabir by name, takes his photo, enters the date of birth, the last
 * four Aadhaar digits and the PAN from the originals with Kabir's consent, and Kabir is verified. His
 * check is taken away before and after, so the local stack only (the photo stays in storage, and the
 * next run's photo replaces it). Rhea is this flow's own reviewer: Auth sends one code a minute.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const KABIR = '00000000-0000-4000-8000-000000000202';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

function removeCheck() {
  sql(`delete from public.kyc_review where member_id = '${KABIR}'`);
  sql(`delete from public.consent where member_id = '${KABIR}' and purpose = 'kyc_verification'`);
  sql(`delete from public.kyc_record where member_id = '${KABIR}'`);
}

/** A plain JPEG made in the page, standing in for the camera. */
async function photo(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 640;
    canvas.getContext('2d')?.fillRect(0, 0, 480, 640);
    return canvas.toDataURL('image/jpeg');
  });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

test.describe('Manual KYC', () => {
  test.skip(isRemoteTarget(), 'takes the member\'s check away in the local database, so the local stack only');
  test.beforeEach(removeCheck);
  test.afterEach(removeCheck);

  test('a KYC reviewer checks a member in person against the originals, and the member is verified', async ({ page }) => {
    await signInToConsole(page, '9000000110');
    await page.getByRole('link', { name: 'KYC review' }).click();
    await expect(page.getByRole('heading', { name: 'Check in person' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }).fill('kabir');
    await expect(page.getByText('Mobile ending 0202')).toBeVisible();
    await page.getByRole('button', { name: 'Check Kabir Sethi' }).click();

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Take their photo' }).click();
    await (await chooser).setFiles({ name: 'kabir.jpg', mimeType: 'image/jpeg', buffer: await photo(page) });
    await expect(page.getByRole('img', { name: 'KYC photo of Kabir Sethi' })).toBeVisible();
    await page.getByLabel('Date of birth on Kabir Sethi\'s original document').fill('1990-04-12');
    await page.getByRole('textbox', { name: 'Last four digits of Kabir Sethi\'s Aadhaar' }).fill('4321');
    await page.getByRole('textbox', { name: 'Kabir Sethi\'s PAN from the original card' }).fill('abcpk4321k');
    await page.getByRole('switch', { name: 'Kabir Sethi agrees to this identity check' }).click();
    await page.getByRole('button', { name: 'Verify Kabir Sethi' }).click();

    await expect(page.getByText('Kabir Sethi is verified and can take a seat.')).toBeVisible();
    expect(sql(`select status || ' ' || method || ' ' || masked_aadhaar from public.kyc_record where member_id = '${KABIR}'`))
      .toBe('verified manual XXXX XXXX 4321');
    expect(sql(`select r.method || ' ' || s.full_name from public.kyc_review r join public.staff s on s.id = r.reviewed_by_staff_id
                where r.member_id = '${KABIR}'`)).toBe('manual Rhea Kulkarni');
  });
});
