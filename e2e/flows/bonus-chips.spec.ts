/**
 * Bonus chips (decision 0504): while the club checks identity at the desk and a sign-up promotion of 500 bonus chips is
 * live, Jayesh Dhillon (his own number here: Auth sends one code a minute) is let in by his selfie and, on Home, is told
 * the 500 bonus chips are his; Rewards shows them. Once the desk has checked him (set here, as kyc.spec.ts proves the
 * desk), the floor (Ishaan Grover, a super admin who signs in to no other flow) seats him at Table 5 redeeming all 500 with
 * his buy-in: no Undo, he is told, his history shows the buy-in and his record's Bonus chips tab who seated him. The
 * switch, the promotion and his check are set up and taken away in the local database, so the local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const JAYESH = '00000000-0000-4000-8000-000000000412';
const CLUB = '00000000-0000-4000-8000-000000000001';

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** Bonus chips as the app shows them: `1,500`. */
const chips = (paise: number) => (paise / 100).toLocaleString('en-IN');

/**
 * Jayesh with no seat, no check and no consent, the club checking identity in the app, and no sign-up promotion live (the
 * seed has none; this flow's own ends). His sign-up grant goes too, so the next run is weighed afresh; the ledger keeps
 * every grant and redemption.
 */
function reset() {
  sql(`delete from public.bonus_redemption where member_id = '${JAYESH}'`);
  sql(`delete from public.waitlist_entry where member_id = '${JAYESH}'`);
  sql(`delete from public.seat_session where member_id = '${JAYESH}'`);
  sql(`delete from public.promotion_grant where member_id = '${JAYESH}' and source_key = 'signup:${JAYESH}'`);
  sql(`update public.promotion_version set status = 'ended' where venue_id = '${CLUB}' and status = 'live' and reward ->> 'on' = 'signup'`);
  sql(`select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.venue_id = '${CLUB}' and v.reward ->> 'on' = 'signup'`);
  sql(`delete from public.setting where venue_id = '${CLUB}' and key = 'kyc.at_the_club'`);
  sql(`delete from public.kyc_review where member_id = '${JAYESH}'`);
  sql(`delete from public.consent where member_id = '${JAYESH}' and purpose = 'kyc_verification'`);
  sql(`delete from public.kyc_record where member_id = '${JAYESH}'`);
}

/** The switch on, as a super admin sets it, and a sign-up promotion of 500 bonus chips live since yesterday. */
function setUp() {
  sql(`insert into public.setting (venue_id, key, subject, value, effective_from, reason)
       values ('${CLUB}', 'kyc.at_the_club', '', '{"enabled": true}', now() - interval '1 minute', 'Cashfree is not live')`);
  sql(`with made as (insert into public.promotion (venue_id, name) values ('${CLUB}', 'Welcome bonus') returning id)
       insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
       select '${CLUB}', made.id, 1, 'live', 'Welcome bonus', '{"kind": "bonus_chips", "chips": 500, "on": "signup"}',
              '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
              jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00',
                                 'startsOn', (private.club_day_of(now()) - 1)::text, 'timezone', 'Asia/Kolkata'),
              '{"perMember": "once"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
       from made`);
  sql(`select private.sync_promotion(v.promotion_id) from public.promotion_version v
       where v.venue_id = '${CLUB}' and v.status = 'live' and v.reward ->> 'on' = 'signup'`);
}

test.describe('Bonus chips', () => {
  test.skip(isRemoteTarget(), 'switches the club to checking identity at the desk and puts a promotion live in the local database, so the local stack only');
  test.beforeEach(reset);
  test.afterEach(reset);

  test('the sign-up bonus on reaching Home, in Rewards, and redeemed by the floor as he sits down', async ({ browser, page }) => {
    setUp();
    const before = Number(sql(`select private.bonus_in_force('${JAYESH}', now())`));

    // His selfie lets him in (decision 0502); on Home he is told of the sign-up bonus, given as he reached it.
    await signInToPlayer(page, '9000000412', '/kyc');
    await page.getByRole('button', { name: 'Take a selfie' }).click();
    await page.getByRole('button', { name: 'Take photo' }).click();
    await page.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByRole('heading', { name: "You're registered." })).toBeVisible();
    await page.getByRole('button', { name: "See tonight's tables" }).click();
    await expect(page.getByText('500 bonus chips added · Welcome bonus')).toBeVisible();
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before + 50_000);

    // Rewards: the bonus chips tile beside points (owner, 8 Nov), its history closed until he opens it.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Rewards' }).click();
    const bonus = page.getByRole('button', { name: /Bonus chips/ });
    await expect(bonus).toContainText(chips(before + 50_000));
    await expect(bonus).toHaveAttribute('aria-expanded', 'false');

    // The desk checks him (kyc.spec.ts walks it); it gives no second sign-up bonus.
    sql(`update public.kyc_record set status = 'verified', method = 'manual', verified_at = now(), date_of_birth = '1990-04-12',
         pan = 'JAYPD4120D', photo_path = '${CLUB}/${JAYESH}/selfie.jpg' where member_id = '${JAYESH}'`);
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before + 50_000);

    // The floor seats him at Table 5 by his number, redeeming the 500 with his buy-in.
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000122');
    await floor.getByRole('button', { name: 'Seat a player' }).click();
    const sheet = floor.getByRole('dialog', { name: 'Seat a player' });
    await sheet.getByRole('radio', { name: 'Table 5' }).click();
    await sheet.getByRole('textbox', { name: 'Or a mobile or member number' }).fill('9000000412');
    await expect(sheet.getByText('Checked as they sit.')).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Bonus chips to redeem' }).fill('500');
    await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByText(/^9000000412 seated at Table 5, seat \d$/)).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Undo' })).toHaveCount(0);
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before);

    // He is told, and his history shows the buy-in.
    await expect(page.getByText('500 bonus chips used for your buy-in at Table 5')).toBeVisible();
    await bonus.click();
    await expect(page.getByRole('heading', { name: 'Bonus chips history' })).toBeVisible();
    await expect(page.getByText(/^Buy-in · Table 5 · /).first()).toBeVisible();
    await expect(page.getByText(/^Welcome bonus · /).first()).toBeVisible();

    // His record's Bonus chips tab, read only, names who seated him.
    await floor.goto(`${appUrl('console')}/members?member=${JAYESH}&part=bonus`);
    await expect(floor.getByRole('link', { name: 'Bonus chips' })).toHaveAttribute('aria-current', 'page');
    await expect(floor.getByText(/Buy-in · Table 5 · seated by Ishaan Grover$/)).toBeVisible();
  });
});
