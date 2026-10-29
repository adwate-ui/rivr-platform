/**
 * Attribution (#10): a new player opens a link to Rewards with a referral and UTM codes, signs in
 * with a code, sees the number they signed in with, adds a photo and gives their name, city, what best describes them and
 * when they usually play (#631), and joins; as their identity check is not done, they see only it (#632); the codes are kept with the sign-up (supabase/tests/014_sign_up proves
 * member.signed_up carries them). Local stack only: it frees its number from the member an earlier run
 * created, and reads the codes, in the local database itself.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';

// Not seeded: this flow signs it up (supabase/config.template.toml, [auth.sms.test_otp]).
const NUMBER = '9000000902';

/** Runs SQL in this worktree's local database and returns its unaligned output. */
function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

test.describe('Attribution', () => {
  test.skip(isRemoteTarget(), 'resets its number and reads the codes in the local database, so the local stack only');

  test('a new player keeps the codes of the link they came by, through sign-in to sign-up', async ({ page }) => {
    // An earlier run signed this number up. Members are never deleted (their ledger accounts stay), so
    // that member gives up the login and the number, and this run signs up afresh.
    sql(`update public.member set user_id = null, phone = '+916' || lpad(floor(random() * 1e9)::bigint::text, 9, '0')
         where phone = '+91${NUMBER}'`);

    // The link points at Rewards: sign-in and sign-up return there once joined (#233).
    await page.setViewportSize(VIEWPORT.player);
    await page.goto(`${appUrl('player')}/rewards?ref=FRIEND1&utm_source=instagram&utm_campaign=launch`);
    await page.getByRole('textbox', { name: 'Mobile number' }).fill(NUMBER);
    await page.getByRole('button', { name: 'Send code' }).click();
    await page.getByRole('textbox', { name: /^Code sent to/ }).fill('123456');
    await page.getByRole('button', { name: 'Verify' }).click();

    await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
    await expect(page.getByText(`Mobile +91 ${NUMBER.slice(0, 5)} ${NUMBER.slice(5)}`)).toBeVisible();
    // The photo is optional (#631): the file picker behind Add a photo takes one.
    const photo = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 240;
      canvas.height = 320;
      canvas.getContext('2d')?.fillRect(0, 0, 240, 320);
      return canvas.toDataURL('image/jpeg');
    });
    await page.locator('input[type=file]').setInputFiles({
      name: 'me.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo.slice(photo.indexOf(',') + 1), 'base64'),
    });
    await expect(page.getByText('Photo added. It is sent when you continue.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Full name as on your Aadhaar' }).fill('Tara Joshi');
    await page.getByRole('textbox', { name: 'City' }).fill('Gurugram');
    await page.getByRole('button', { name: 'Salaried or working professional' }).click();
    await page.getByRole('button', { name: 'Weekday evenings (18:00 to 22:00)' }).click();
    await page.getByRole('button', { name: 'Weekends', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    // A new member's identity check is not done, so they see only its steps first (#632).
    await expect(page.getByRole('heading', { name: 'Identity', level: 1 })).toBeVisible();

    expect(
      sql(`select m.full_name || '|' || a.referral_code || '|' || a.utm_source || '|' || a.utm_campaign
           from public.sign_up_attribution a join public.member m on m.id = a.member_id where m.phone = '+91${NUMBER}'`),
    ).toBe('Tara Joshi|FRIEND1|instagram|launch');
    expect(sql(`select p.city || '|' || p.occupation || '|' || array_to_string(p.play_times, ',') from public.member_preference p
                join public.member m on m.id = p.member_id where m.phone = '+91${NUMBER}'`)).toBe('Gurugram|salaried|weekday_evenings,weekends');
    expect(sql(`select count(*) from storage.objects o join public.member m on o.name = m.venue_id || '/' || m.id || '/photo.jpg'
                where o.bucket_id = 'kyc' and m.phone = '+91${NUMBER}'`)).toBe('1');
  });
});
