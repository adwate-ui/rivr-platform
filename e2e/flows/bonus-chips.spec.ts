/**
 * Bonus chips (decision 0504): while the club checks identity at the desk and a sign-up promotion of 500 bonus chips is
 * live, Jayesh Dhillon (his own number here: Auth sends one code a minute) is let in by his selfie; his sign-up Bonus
 * waits for a super admin (decision 0670), and once the floor (Ishaan Grover, a super admin who signs in to no other flow)
 * approves it he is told the 500 bonus chips are his; Bonus shows them. Once the desk has checked him (set here, as
 * kyc.spec.ts proves the desk), Ishaan seats him at Table 5 redeeming all 500 with
 * his buy-in: no Undo, he is told, his history shows the buy-in and his record's Bonus chips tab who seated him; there
 * Ishaan adds 50 by hand, which Jayesh's history shows with its reason (redesign of 15 Nov), and resets his counted hours
 * with a reason (redesign RD-36). The
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

/** The reason Ishaan gives for the Bonus he adds by hand: this run's own, so an earlier run's line never passes for it. */
const REASON = `Long wait ${Date.now().toString(36).slice(-5)}`;

/** Bonus chips as the app shows them: `1,500`. */
const chips = (paise: number) => (paise / 100).toLocaleString('en-IN');

/**
 * Jayesh with no seat, no check and no consent, the club checking identity in the app, and no sign-up promotion live (the
 * seed has none; this flow's own ends). His sign-up grant goes too, so the next run is weighed afresh; the ledger keeps
 * every grant and redemption.
 */
function reset() {
  // Bonus he owes after a reversal (#1077) can never be deleted: Bonus given sets it right, as the club would.
  sql(`select private.credit_bonus('${CLUB}', '${JAYESH}', x.owed, 'Set right after the flow', null, 'e2e-settle:' || gen_random_uuid())
       from (select private.bonus_owed_by('${JAYESH}') as owed) x where x.owed > 0`);
  sql(`delete from public.bonus_redemption where member_id = '${JAYESH}'`);
  sql(`update public.member set hours_counted_from = null where id = '${JAYESH}' and hours_counted_from is not null`);
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

test.describe('Bonus', () => {
  test.skip(isRemoteTarget(), 'switches the club to checking identity at the desk and puts a promotion live in the local database, so the local stack only');
  test.beforeEach(reset);
  test.afterEach(reset);

  test('the sign-up bonus on reaching Home, in Bonus, redeemed by the floor as he sits down, and Bonus by hand on his record; Reset hours: his hours start from zero', async ({ browser, page }) => {
    setUp();
    const before = Number(sql(`select private.bonus_in_force('${JAYESH}', now())`));

    // His selfie lets him in (decision 0502); his sign-up bonus waits for a super admin (decision 0670), who approves it,
    // and on Home he is told of it.
    await signInToPlayer(page, '9000000412', '/kyc');
    await page.getByRole('button', { name: 'Take a selfie' }).click();
    await page.getByRole('button', { name: 'Take photo' }).click();
    await page.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByRole('heading', { name: 'Registered', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'See the tables' }).click();
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000122', '/promotions?tab=bonus');
    await floor.getByRole('table', { name: 'Bonus to approve' }).getByRole('row').filter({ hasText: 'Jayesh Dhillon' })
      .getByRole('button', { name: 'Approve 500 Bonus for Jayesh Dhillon' }).click();
    await expect(floor.getByText('1 approved · 500 Bonus')).toBeVisible();
    await expect(page.getByText('500 Bonus added · Welcome bonus')).toBeVisible();
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before + 50_000);

    // Bonus: his balance, and the welcome bonus in his history.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Rewards' }).click();
    await expect(page.getByRole('heading', { name: 'Bonus', level: 1 })).toBeVisible();
    await expect(page.getByText(chips(before + 50_000), { exact: true })).toBeVisible();
    // A line of history: what it was, with its day beneath (redesign RD-20).
    await expect(page.getByText('Welcome bonus', { exact: true }).first()).toBeVisible();

    // The desk checks him (kyc.spec.ts walks it); it gives no second sign-up bonus.
    sql(`update public.kyc_record set status = 'verified', method = 'manual', verified_at = now(), date_of_birth = '1990-04-12',
         pan = 'JAYPD4120D', photo_path = '${CLUB}/${JAYESH}/selfie.jpg' where member_id = '${JAYESH}'`);
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before + 50_000);

    // The floor seats him at Table 5 by his number, redeeming the 500 with his buy-in.
    await floor.goto(appUrl('console'));
    await floor.getByRole('button', { name: 'Seat a player' }).click();
    const sheet = floor.getByRole('dialog', { name: 'Seat a player' });
    await sheet.getByRole('radio', { name: 'Table 5' }).click();
    await sheet.getByRole('textbox', { name: /^(Or a n|N)ame, mobile or member number$/ }).fill('9000000412');
    await expect(sheet.getByText('Up to their balance. Taken off when they sit.')).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Bonus to redeem' }).fill('500');
    await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByText(/^9000000412 seated at Table 5, seat \d$/)).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Undo' })).toHaveCount(0);
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before);

    // He is told, and his history shows the buy-in.
    await expect(page.getByText('500 Bonus used for your buy-in at Table 5')).toBeVisible();
    await expect(page.getByText('Buy-in · Table 5', { exact: true }).first()).toBeVisible();

    // His record's Bonus chips tab, read only, names who seated him.
    await floor.goto(`${appUrl('console')}/members?member=${JAYESH}&part=bonus`);
    await expect(floor.getByRole('link', { name: 'Bonus' })).toHaveAttribute('aria-current', 'page');
    await expect(floor.getByText(/Buy-in · Table 5 · seated by Ishaan Grover$/)).toBeVisible();

    // Bonus by hand, on the record: 50 with a reason, asked twice; his app shows it.
    // A super admin's record has a missed-use form too: the Add Bonus region holds this one's fields.
    const byHand = floor.getByRole('region', { name: 'Add Bonus' });
    await byHand.getByRole('textbox', { name: /^Bonus/ }).fill('50');
    await byHand.getByRole('textbox', { name: /^Reason/ }).fill(REASON);
    await floor.getByRole('button', { name: 'Add Bonus' }).click();
    await floor.getByRole('button', { name: 'Yes, add 50 Bonus' }).click();
    await expect(floor.getByText('50 Bonus added.')).toBeVisible();
    expect(Number(sql(`select private.bonus_in_force('${JAYESH}', now())`))).toBe(before + 5_000);
    await expect(page.getByText(REASON, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    // Reset hours (redesign RD-36): seated an hour ago here, his hour counts; Ishaan, a super admin, resets his hours from the
    // record's Visits with a reason, asked twice; they start from zero, and the audit log keeps who, when and why.
    sql(`update public.seat_session set started_at = now() - interval '61 minutes', seated_here_at = now() - interval '61 minutes' where member_id = '${JAYESH}' and ended_at is null`);
    const counted = () => Number(sql(`select coalesce((select played_minutes from private.hours_leaderboard('${CLUB}', 'all', 1000, null, now()) where member_id = '${JAYESH}'), 0)`));
    expect(counted()).toBeGreaterThanOrEqual(60);
    await floor.getByRole('navigation', { name: /^Record of/ }).getByRole('link', { name: 'Visits' }).click();
    await floor.getByRole('textbox', { name: 'Why they are reset' }).fill(`${REASON} hours`);
    await floor.getByRole('button', { name: 'Reset hours' }).click();
    await floor.getByRole('button', { name: 'Yes, reset the hours of Jayesh Dhillon' }).click();
    await expect(floor.getByText('Hours reset.')).toBeVisible();
    expect(counted()).toBe(0);
    expect(sql(`select reason from public.audit_log where action = 'member.hours_reset' and entity_id = '${JAYESH}' order by id desc limit 1`)).toBe(`${REASON} hours`);

    // The owner, 18 Nov: a super admin adds a use his seat missed (past its Undo now), then reverses the 50 added by hand,
    // which that use spent: he owes 50, and his app shows both, with no reason (the owner, 19 Nov). The use stays within his
    // balance, so nothing owed names it and reset() can delete it; the 50 owed after the reversal reset() sets right.
    await floor.getByRole('navigation', { name: /^Record of/ }).getByRole('link', { name: 'Bonus' }).click();
    const missed = floor.getByRole('region', { name: 'Missed Bonus use' });
    await missed.getByRole('radio', { name: /^Table 5 · seat \d+ · / }).click();
    await missed.getByRole('textbox', { name: /^Bonus used/ }).fill('50');
    await missed.getByRole('textbox', { name: /^Reason/ }).fill(`${REASON} missed`);
    await missed.getByRole('button', { name: 'Add use' }).click();
    await missed.getByRole('button', { name: 'Yes, take 50 Bonus' }).click();
    await expect(floor.getByText('50 Bonus use added.')).toBeVisible();
    await expect(page.getByText('Buy-in · Table 5', { exact: true })).toHaveCount(2, { timeout: 15_000 });
    await floor.getByRole('button', { name: new RegExp(`${REASON}.*Reverse$`) }).click();
    const reversing = floor.getByRole('dialog', { name: 'Reverse Bonus' });
    await reversing.getByRole('textbox', { name: /^Reason/ }).fill(`${REASON} back`);
    await reversing.getByRole('button', { name: 'Reverse' }).click();
    await expect(floor.getByText('50 Bonus reversed.')).toBeVisible();
    expect(Number(sql(`select private.bonus_balance('${JAYESH}', now())`))).toBe(-5_000);
    await expect(page.getByText('Reversed', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`${REASON} back`)).toHaveCount(0);
  });
});
