/**
 * Manual KYC (#246): while no KYC vendor is live, a KYC reviewer checks a member in person at the
 * club. Rhea (membership manager) finds Kabir by name, takes his photo, enters the date of birth, the last
 * four Aadhaar digits and the PAN from the originals with Kabir's consent, and Kabir is verified. His
 * check is taken away before and after, so the local stack only (the photo stays in storage, and the
 * next run's photo replaces it). Rhea is this flow's own reviewer: Auth sends one code a minute.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { takeDeskPhotos } from '../support/deskPhotos.ts';
import { signInToConsole } from '../support/signIn.ts';

const KABIR = '00000000-0000-4000-8000-000000000202';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

function removeCheck() {
  sql(`delete from public.kyc_document where member_id = '${KABIR}'`);
  sql(`delete from public.kyc_review where member_id = '${KABIR}'`);
  sql(`delete from public.consent where member_id = '${KABIR}' and purpose = 'kyc_verification'`);
  sql(`delete from public.kyc_record where member_id = '${KABIR}'`);
}


// The desk's photos take a phone or tablet's back camera: a computer is sent on to one (decision 0573).
test.use({ hasTouch: true });

test.describe('Manual KYC', () => {
  test.skip(isRemoteTarget(), 'takes the member\'s check away in the local database, so the local stack only');
  test.beforeEach(removeCheck);
  test.afterEach(removeCheck);

  test('a KYC reviewer checks a member in person against the originals, a super admin sends a photo back, and the desk takes it again', async ({ page, browser }) => {
    await signInToConsole(page, '9000000110');
    await page.getByRole('link', { name: 'ID checks', exact: true }).click();
    // ID check in person opens its sheet (console v3).
    await page.getByRole('button', { name: 'ID check in person' }).click();
    await expect(page.getByRole('dialog', { name: 'ID check in person' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }).fill('kabir');
    await expect(page.getByText('Mobile ending 0202')).toBeVisible();
    await page.getByRole('button', { name: 'Check Kabir Sethi' }).click();

    // Taken with the console's camera, the browser's fake one here (playwright.config.ts), never a file (K-07).
    await takeDeskPhotos(page);
    await expect(page.getByRole('img', { name: 'ID check photo of Kabir Sethi' })).toBeVisible();
    await page.getByLabel('Date of birth on Kabir Sethi\'s original document').fill('1990-04-12');
    await page.getByRole('textbox', { name: 'Last four digits of Kabir Sethi\'s Aadhaar' }).fill('4321');
    await page.getByRole('textbox', { name: 'Kabir Sethi\'s PAN from the original card' }).fill('abcpk4321k');
    await page.getByRole('switch', { name: 'Kabir Sethi agrees to this ID check' }).click();
    await page.getByRole('button', { name: 'Verify Kabir Sethi' }).click();

    // Read out as it appears (F1-23).
    await expect(page.getByRole('status').getByText('Kabir Sethi is verified and can take a seat.')).toBeVisible();
    expect(sql(`select status || ' ' || method || ' ' || masked_aadhaar from public.kyc_record where member_id = '${KABIR}'`))
      .toBe('verified manual XXXX XXXX 4321');
    expect(sql(`select r.method || ' ' || s.full_name from public.kyc_review r join public.staff s on s.id = r.reviewed_by_staff_id
                where r.member_id = '${KABIR}'`)).toBe('manual Rhea Kulkarni');
    expect(sql(`select string_agg(d.kind || ' ' || coalesce(s.full_name, 'none'), ', ' order by d.kind) from public.kyc_document d
                left join public.staff s on s.id = d.covers_confirmed_by_staff_id where d.member_id = '${KABIR}'`))
      .toBe('aadhaar_front Rhea Kulkarni, pan none');

    // A super admin opens the Aadhaar, which is audited, and sends it back in words.
    const context = await browser.newContext({ viewport: VIEWPORT.console });
    const admin = await context.newPage();
    await signInToConsole(admin, '9000000118', `/members?member=${KABIR}&part=account`);
    await admin.getByRole('button', { name: 'Open the Aadhaar front' }).click();
    await expect(admin.getByRole('img', { name: 'Aadhaar front' })).toBeVisible();
    await admin.getByRole('textbox', { name: 'Why the Aadhaar front needs taking again' }).fill('Digits showing');
    await admin.getByRole('button', { name: 'Send back' }).click();
    await expect(admin.getByText('Sent back: Digits showing. Waiting for the desk.')).toBeVisible();
    expect(sql(`select count(*) from public.audit_log where action = 'kyc_image.view'
                and entity_id = (select path from public.kyc_document where member_id = '${KABIR}' and kind = 'aadhaar_front')`)).toBe('1');
    await context.close();

    // The desk is told why, and takes that photo alone.
    await page.goto(`${appUrl('console')}/kyc-review`);
    await page.getByRole('button', { name: 'ID check in person' }).click();
    await page.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }).fill('kabir');
    await expect(page.getByText('A photo was sent back. Take it again.')).toBeVisible();
    await page.getByRole('button', { name: 'Check Kabir Sethi' }).click();
    await expect(page.getByText('Sent back: Digits showing.')).toBeVisible();
    await page.getByRole('button', { name: 'Photograph the Aadhaar front' }).click();
    await page.getByRole('button', { name: 'Take photo' }).click();
    await page.getByRole('switch', { name: /^The bars hide/ }).click();
    await page.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByRole('status').getByText('New photo kept for Kabir Sethi.')).toBeVisible();
    expect(sql(`select retake_asked_at is null from public.kyc_document where member_id = '${KABIR}' and kind = 'aadhaar_front'`)).toBe('t');
  });
});
