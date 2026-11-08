/**
 * KYC (#4, #5): a member takes a selfie with the live camera, checks their identity with DigiLocker and is welcomed by
 * their first name (decision 0320). The practice venue uses the fake vendor, which consents at once and
 * sends the member straight back; a real venue without vendor keys fails closed (decision 0014). Staging has
 * Cashfree's sandbox keys (#474, decision 0197), so there the real venue's check goes to Cashfree instead.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { localSupabaseEnv, worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { serviceRoleKey } from '../support/serviceRole.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/**
 * Opens Identity and takes the selfie with the camera, unless an earlier run already took it: the browser's fake camera
 * (playwright.config.ts) is the picture, and the practice venue's fake vendor passes any selfie. Never a file (K-07).
 */
async function takeSelfie(page: Page) {
  await page.goto(`${appUrl('player')}/kyc`);
  const take = page.getByRole('button', { name: 'Take a selfie' });
  const start = page.getByRole('button', { name: 'Continue to DigiLocker' });
  await expect(take.or(start).or(page.getByRole('heading', { name: 'Verified', exact: true }))).toBeVisible();
  if (!(await take.isVisible())) return;
  await expect(page.getByRole('list', { name: 'Identity check' })).toBeVisible();
  await take.click();
  await page.getByRole('button', { name: 'Take photo' }).click();
  await expect(page.getByRole('img', { name: 'Your photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Use photo' }).click();
}

/** After the selfie, sets off for DigiLocker, unless an earlier run already verified this member. */
async function startDigiLocker(page: Page) {
  const start = page.getByRole('button', { name: 'Continue to DigiLocker' });
  await expect(start.or(page.getByRole('heading', { name: 'Verified', exact: true }))).toBeVisible();
  if (await start.isVisible()) await start.click();
}

test.describe('KYC', () => {
  test('Identity › Start, Camera, Review selfie, Verified: a practice-venue member is verified with a selfie and DigiLocker in under three minutes', async ({ page }) => {
    const began = Date.now();
    await signInToPlayer(page, '9000000301', '/kyc');
    await takeSelfie(page);
    await startDigiLocker(page);
    await expect(page.getByRole('heading', { name: 'Verified', exact: true })).toBeVisible();
    await expect(page.getByText(/^Welcome to RIVR, \w+\.$/)).toBeVisible();
    expect(Date.now() - began).toBeLessThan(180_000);
    await page.getByRole('button', { name: 'See the tables' }).click();
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
  });

  test('a real venue without a KYC vendor fails closed', async ({ page }) => {
    await signInToPlayer(page, '9000000218', '/kyc');
    // Until the check is done the member sees only its steps (#632): Home sends them back to it.
    await page.goto(appUrl('player'));
    await expect(page).toHaveURL(/\/kyc$/);
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    // Staging's real venue has Cashfree's sandbox keys, so its KYC is open, not closed: it is proved locally.
    if (isRemoteTarget()) return;
    await takeSelfie(page);
    await expect(page.getByRole('alert').getByText('Identity checks are not open yet.')).toBeVisible();
  });

  test('a member DigiLocker failed for can try it again from the PAN step; one it matched without a PAN is not offered it', async ({ browser, page, request }) => {
    test.skip(isRemoteTarget(), 'fails a member\'s DigiLocker with the service role, so the local stack only');
    // Shreya Mittal set off for DigiLocker (seed: started) and it failed, as the kyc function records it with the service
    // role: a PAN check with no date of birth. Once failed, failing again changes nothing.
    const { url } = localSupabaseEnv();
    const service = serviceRoleKey();
    const failed = await request.post(`${url}/rest/v1/rpc/record_kyc_digilocker_failed`, {
      headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' },
      data: { p_member_id: '00000000-0000-4000-8000-000000000403' },
    });
    expect(failed.ok(), await failed.text()).toBe(true);
    await signInToPlayer(page, '9000000403', '/kyc');
    await expect(page.getByRole('heading', { name: 'PAN', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Try DigiLocker again' }).click();
    // The seed keeps no selfie for her, so the kyc function refuses the start and the step says so. A member who reached
    // the PAN step in the app took the selfie first.
    await expect(page.getByText('Identity checks are down. Try again shortly.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PAN', level: 1 })).toBeVisible();

    // Shivam Kalra's DigiLocker matched but held no PAN (seed: needs_pan with his date of birth): the PAN alone verifies him.
    const matched = await browser.newPage();
    await signInToPlayer(matched, '9000000442', '/kyc');
    await expect(matched.getByRole('heading', { name: 'PAN', level: 1 })).toBeVisible();
    await expect(matched.getByRole('button', { name: 'Verify' })).toBeVisible();
    await expect(matched.getByRole('button', { name: 'Try DigiLocker again' })).toHaveCount(0);
  });
});

const UDAY = '00000000-0000-4000-8000-000000000418';
const CLUB = '00000000-0000-4000-8000-000000000001';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Uday with no check, no bonus and no consent, and the club checking identity in the app: before and after. */
function resetAtTheClub() {
  sql(`delete from public.setting where venue_id = '${CLUB}' and key = 'kyc.at_the_club'`);
  sql(`delete from public.kyc_review where member_id = '${UDAY}'`);
  sql(`delete from public.consent where member_id = '${UDAY}' and purpose = 'kyc_verification'`);
  sql(`delete from public.kyc_record where member_id = '${UDAY}'`);
}

test.describe('Identity › At the club', () => {
  test.skip(isRemoteTarget(), 'switches the club to checking identity at the desk in the local database, so the local stack only');
  test.beforeEach(resetAtTheClub);
  test.afterEach(resetAtTheClub);

  test('switched on, a member registers with a selfie, is let in, and the desk verifies them with the bonus of their selfie day', async ({ browser, page }) => {
    // The switch as a super admin sets it from Settings, with its reason (decision 0502); the bonus as it stood that day.
    sql(`insert into public.setting (venue_id, key, subject, value, effective_from, reason)
         values ('${CLUB}', 'kyc.at_the_club', '', '{"enabled": true}', now() - interval '1 minute', 'Cashfree is not live')`);
    const bonusBefore = Number(sql(`select coalesce(-sum(private.account_balance(a.id)), 0) from public.ledger_account a
                                    where a.member_id = '${UDAY}' and a.code = 'member.points'`));
    // The ledger is append-only: an earlier run's bonus stays, and the bonus is paid once.
    const wasPaid = sql(`select exists (select 1 from public.ledger_transaction where idempotency_key = 'verified_bonus:${UDAY}')`) === 't';

    await signInToPlayer(page, '9000000418', '/kyc');
    await expect(page.getByText('Aadhaar and PAN at the desk, on your first visit')).toBeVisible();
    await page.getByRole('button', { name: 'Take a selfie' }).click();
    await page.getByRole('button', { name: 'Take photo' }).click();
    await page.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByRole('heading', { name: 'Registered', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'See the tables' }).click();
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeVisible();
    await expect(page.getByText('Bring your Aadhaar and PAN on your first visit. The desk checks them before you play.')).toBeVisible();
    expect(sql(`select status || ' ' || (at_club_from is not null) from public.kyc_record where member_id = '${UDAY}'`)).toBe('started true');

    // At the desk: Sunita (host) finds Uday, sees his app selfie beside the camera, and checks his originals.
    const desk = await browser.newPage();
    await signInToConsole(desk, '9000000124', '/kyc-review');
    await desk.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }).fill('Uday');
    await expect(desk.getByText('Selfie taken in the app. Check their originals.')).toBeVisible();
    await desk.getByRole('button', { name: 'Check Uday Thakur' }).click();
    await expect(desk.getByRole('img', { name: 'The selfie Uday Thakur took in the app' })).toBeVisible();
    await desk.getByRole('button', { name: 'Take their photo' }).click();
    await desk.getByRole('button', { name: 'Take photo' }).click();
    await desk.getByRole('button', { name: 'Use photo' }).click();
    await desk.getByLabel('Date of birth on Uday Thakur\'s original document').fill('1991-03-18');
    await desk.getByRole('textbox', { name: 'Last four digits of Uday Thakur\'s Aadhaar' }).fill('4180');
    await desk.getByRole('textbox', { name: 'Uday Thakur\'s PAN from the original card' }).fill('udapt4180t');
    await desk.getByRole('switch', { name: 'Uday Thakur agrees to this identity check' }).click();
    await desk.getByRole('button', { name: 'Verify Uday Thakur' }).click();
    await expect(desk.getByRole('status').getByText('Uday Thakur is verified and can take a seat.')).toBeVisible();

    expect(sql(`select status || ' ' || method from public.kyc_record where member_id = '${UDAY}'`)).toBe('verified manual');
    const bonusDue = Number(sql(`select coalesce((private.setting_at('${CLUB}', 'points.verified_bonus', '',
                                   (select at_club_from from public.kyc_record where member_id = '${UDAY}')) ->> 'points')::bigint, 0)`));
    const bonusAfter = Number(sql(`select coalesce(-sum(private.account_balance(a.id)), 0) from public.ledger_account a
                                   where a.member_id = '${UDAY}' and a.code = 'member.points'`));
    expect(bonusAfter - bonusBefore).toBe(wasPaid ? 0 : bonusDue);
  });
});
