/**
 * Home, Bonus and Profile after the redesign (RD-20). Vishal Dutta, this flow's own member (Auth sends one code a minute to
 * a number), opens Home with two notices in force and three or more live offers: one card above the offers, the notice
 * that started last, with nothing to close it; the offers as one carousel that moves on by itself and holds the slide
 * whose dot he taps; table rows with the minimum buy-in and no count of players. While the desk has not checked him the
 * one card is his ID check. Bonus says a reward for a friend only while the referral promotion is live, and its balance's
 * line follows the "Bonus expires" setting. Profile has no line for Bonus notifications. Seated by Rahul Verma, this flow's
 * own floor manager, Home shows no card and keeps the offers. The notices, promotions, setting, check and seat are set
 * up and taken away in the local database, so the local stack only.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { worktreeName } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { seatOnFloor } from '../support/floor.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const VISHAL = '00000000-0000-4000-8000-000000000440';
const CLUB = '00000000-0000-4000-8000-000000000001';
const EARLIER = 'Home flow: valet parking at the back gate.';
const LATER = 'Home flow: the kitchen closes at 1 tonight.';
/** A count of players seated, waiting or seats open, in any of the words the app has had for one. */
const A_COUNT = /\d+ (waiting|open|seated|players)|seats? open|No wait/i;

function sql(query: string): string {
  return execFileSync('docker', ['exec', `supabase_db_${worktreeName()}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' }).trim();
}

/** The referral promotion's version put to `status`, as pausing and resuming it in the builder does. */
function referral(status: 'live' | 'paused') {
  sql(`update public.promotion_version v set status = '${status}' from public.promotion p
       where p.id = v.promotion_id and p.venue_id = '${CLUB}' and p.template_key = 'referral' and v.version = p.current_version`);
  sql(`select private.sync_promotion(p.id) from public.promotion p where p.venue_id = '${CLUB}' and p.template_key = 'referral'`);
}

/** Vishal verified, with no seat or place; the flow's notices, promotions and setting gone; the referral promotion live. */
function reset() {
  sql(`delete from public.waitlist_entry where member_id = '${VISHAL}'`);
  sql(`delete from public.seat_session where member_id = '${VISHAL}'`);
  sql(`update public.kyc_record set status = 'verified', verified_at = now(), at_club_from = null where member_id = '${VISHAL}'`);
  sql(`delete from public.notice where venue_id = '${CLUB}' and body like 'Home flow:%'`);
  sql(`update public.promotion_version set status = 'ended' where venue_id = '${CLUB}' and status = 'live' and name like 'Home flow %'`);
  sql(`select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.venue_id = '${CLUB}' and v.name like 'Home flow %'`);
  sql(`delete from public.setting where venue_id = '${CLUB}' and key = 'bonus.expiry_days' and reason = 'Home flow'`);
  referral('live');
}

/** A live promotion on the player app alone, on the terms of the four-hour template, with its card's words. */
function promotion(name: string, detail: string, runs: string) {
  sql(`with made as (insert into public.promotion (venue_id, name) values ('${CLUB}', '${name}') returning id)
       insert into public.promotion_version (venue_id, promotion_id, version, status, name, detail, runs, reward, eligibility, schedule, limits, channels)
       select '${CLUB}', made.id, 1, 'live', '${name}', '${detail}', '${runs}', t.reward, t.eligibility, t.schedule, t.limits,
              '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}'
       from made, public.promotion_version t join public.promotion p on p.id = t.promotion_id
       where p.venue_id = '${CLUB}' and p.template_key = 'hours_bonus' and t.version = 1`);
  sql(`select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.venue_id = '${CLUB}' and v.name = '${name}'`);
}

/** Two notices in force, the later one a minute old, and two more live promotions. */
function setUp() {
  sql(`insert into public.notice (venue_id, body, starts_at) values
       ('${CLUB}', '${EARLIER}', now() - interval '2 hours'), ('${CLUB}', '${LATER}', now() - interval '1 minute')`);
  promotion('Home flow four hours', '1,000 Bonus after 4 hours', 'Every day, all tables');
  promotion('Home flow late night', '500 Bonus after midnight', 'Fridays');
}

/** The carousel's dot that is current: "Offer 2 of 4". */
const currentDot = (page: Page) => page.getByRole('region', { name: 'Offers' }).locator('button[aria-current="true"]');

const openTab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();

/** How far down the page something starts. */
async function topOf(part: Locator): Promise<number> {
  const box = await part.boundingBox();
  if (box === null) throw new Error('Not on the page');
  return box.y;
}

/**
 * Bonus: the balance's line follows "Bonus expires", and a friend's reward is promised only while the referral promotion
 * is live; with it paused, the invite stays and no word of a reward.
 */
async function bonusFollowsTheClub(page: Page) {
  await openTab(page, 'Bonus');
  await expect(page.getByText('Use with your buy-in. Never expires.')).toBeVisible();
  await expect(page.getByText('1,000 Bonus each. When a friend joins and takes a first seat.')).toBeVisible();
  sql(`insert into public.setting (venue_id, key, subject, value, effective_from, reason)
       values ('${CLUB}', 'bonus.expiry_days', '', '{"days": 30}', now() - interval '1 minute', 'Home flow')`);
  referral('paused');
  await page.reload();
  await expect(page.getByText('Use with your buy-in. Expires after 30 days.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share invite' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/Bonus each|first seat|for you both/i);
}

/** Profile: every row but a line for Bonus notifications. */
async function profileHasNoBonusLine(page: Page) {
  await openTab(page, 'Profile');
  await expect(page.getByRole('heading', { name: 'Vishal Dutta', level: 1 })).toBeVisible();
  for (const name of ['Seat calls', 'Call time', 'Offers', 'Name on club TVs']) await expect(page.getByRole('switch', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Bonus/ })).toHaveCount(0);
  for (const name of ['House rules', 'Send feedback', 'Delete my account', 'Sign out']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
}

test.describe('Home', () => {
  test.skip(isRemoteTarget(), 'puts notices and promotions up, sets a setting and seats a member in the local database, so the local stack only');
  test.beforeEach(reset);
  test.afterEach(reset);

  test('Home: one card above the offers, one carousel with dots that hold, rows with no counts; Bonus and Profile follow the club', async ({ browser, page }) => {
    test.setTimeout(120_000);
    setUp();
    await signInToPlayer(page, '9000000440');

    // One card above the offers: the notice that started last, in full, with nothing to close it.
    const card = page.getByRole('article', { name: 'From the club' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(LATER);
    await expect(page.getByText(EARLIER)).toHaveCount(0);
    await expect(card.getByRole('button')).toHaveCount(0);

    // The offers: one carousel through every live one, a dot each, one of them current.
    const offers = page.getByRole('region', { name: 'Offers' });
    const slides = offers.getByRole('listitem');
    const dots = offers.getByRole('button', { name: /^Offer \d+ of \d+$/ });
    await expect(offers.getByText('1,000 Bonus after 4 hours')).toHaveCount(1);
    await expect(offers.getByText('500 Bonus after midnight')).toHaveCount(1);
    await expect(offers.getByText('Refer a friend')).toHaveCount(1);
    const count = await slides.count();
    expect(count).toBeGreaterThanOrEqual(3);
    await expect(dots).toHaveCount(count);
    await expect(currentDot(page)).toHaveCount(1);
    const shownFirst = await currentDot(page).getAttribute('aria-label') ?? '';
    // The card is above the offers, and the offers above the tables.
    expect(await topOf(card)).toBeLessThan(await topOf(offers));
    expect(await topOf(offers)).toBeLessThan(await topOf(page.getByRole('heading', { name: 'All tables' })));
    // It moves on by itself; a tapped dot shows its slide and holds it past the next move.
    await expect(currentDot(page)).not.toHaveAccessibleName(shownFirst, { timeout: 8_000 });
    const held = `Offer ${String(count)} of ${String(count)}`;
    await offers.getByRole('button', { name: held }).click();
    await expect(currentDot(page)).toHaveAccessibleName(held);
    await expect(slides.last()).toBeInViewport();
    await page.waitForTimeout(6_500);
    await expect(currentDot(page)).toHaveAccessibleName(held);
    await expect(slides.last()).toBeInViewport();

    // A table's row: its stake and its minimum buy-in, and no count of players seated, waiting or seats open.
    const table = page.getByRole('button', { name: /^Table 1 · NLH / });
    await expect(table).toContainText(/Min buy-in ₹[\d,]+$/);
    expect(await page.locator('body').innerText()).not.toMatch(A_COUNT);

    // While the desk has not checked him, the one card is his ID check, and the notice waits.
    sql(`update public.kyc_record set status = 'started', verified_at = null, at_club_from = now() where member_id = '${VISHAL}'`);
    await page.reload();
    await expect(page.getByRole('article', { name: 'ID check' })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByText(LATER)).toHaveCount(0);
    sql(`update public.kyc_record set status = 'verified', verified_at = now(), at_club_from = null where member_id = '${VISHAL}'`);

    await bonusFollowsTheClub(page);
    await openTab(page, 'Home');
    await expect(offers.getByText('1,000 Bonus after 4 hours')).toHaveCount(1);
    await expect(offers.getByText('Refer a friend')).toHaveCount(0);
    await profileHasNoBonusLine(page);

    // Seated: no card at all, the offers under the seat, and still no count.
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000142');
    await seatOnFloor(floor, { table: 'Table 2', seat: 7, number: '9000000440' });
    await openTab(page, 'Home');
    await expect(page.getByRole('heading', { name: 'Table 2, seat 7' })).toBeVisible({ timeout: 15_000 });
    await expect(offers.getByText('1,000 Bonus after 4 hours')).toHaveCount(1);
    await expect(page.getByRole('article')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(A_COUNT);
  });
});
