/**
 * Log a high hand (redesign RD-24; decision 0623). While a high hand runs, the Live floor shows its strip. Farid Khan, an
 * admin, seats Devansh Malik at Table 2 and logs his four Jacks from the strip: the table, the player, the hand, its rank
 * and each rule, then the line that says what will be paid, and Pay. A toast names the player and the hand, and the strip
 * counts it. A royal flush after it takes the night to five figures, and the strip still keeps one line at 1440 px and at
 * tablet width. Leena Dutt, a super admin, reads the hit in Activity, and on the promotion's record, whose Log a high hand
 * brings her to the floor's panel. 163 Farid, 164 Leena and 261 Devansh are the flow's own. Local stack only: it puts a
 * high hand live in the local database and ends it.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { seatOnFloor } from '../support/floor.ts';
import { endHighHands, endSeatOf, liveHighHand, shoot, sql } from '../support/highHand.ts';
import { signInToConsole } from '../support/signIn.ts';

const DEVANSH = '00000000-0000-4000-8000-000000000261';
const NAME = `High hand bonus ${Date.now().toString(36).slice(-5)}`;

const stripOf = (page: Page) => page.getByRole('region', { name: 'High hand bonus' });

/** Logs a hit for Devansh at Table 2 from the strip: the hand, its rank if it has one, each rule confirmed, then Pay. */
async function logHit(floor: Page, { hand, rank, pays, shot }: { hand: string; rank?: { label: string; value: string }; pays: string; shot?: string }) {
  await stripOf(floor).getByRole('button', { name: 'Log a high hand' }).click();
  const panel = floor.getByRole('dialog', { name: 'Log a high hand' });
  await panel.getByRole('radio', { name: 'Table 2' }).click();
  await panel.getByRole('radio', { name: 'Devansh Malik' }).click();
  await panel.getByRole('radio', { name: hand }).click();
  if (rank !== undefined) await panel.getByRole('radiogroup', { name: rank.label }).getByRole('radio', { name: rank.value }).click();
  // Nothing is paid until each rule is confirmed.
  await expect(panel.getByRole('button', { name: 'Pay', exact: true })).toBeDisabled();
  for (const rule of ['Both hole cards played', 'Shown at showdown', '4 or more players dealt in']) await panel.getByRole('switch', { name: rule }).click();
  await expect(panel.getByText(`Pays ${pays}, Table 2, seat 3.`)).toBeVisible();
  if (shot !== undefined) await shoot(floor, shot);
  await panel.getByRole('button', { name: /^Pay [\d,]+ Bonus$/ }).click();
}

/** The strip on one line: every part of it sits on the same row, and none spills out of it. */
async function expectOneLine(strip: Locator) {
  const isOneLine = await strip.evaluate((element) => {
    const centres = [...element.children].map((part) => part.getBoundingClientRect()).map((box) => box.top + box.height / 2);
    return Math.max(...centres) - Math.min(...centres) < 2 && element.scrollWidth <= element.clientWidth;
  });
  expect(isOneLine).toBe(true);
}

test.describe('Log a high hand', () => {
  test.skip(isRemoteTarget(), 'puts a high hand live in the local database, so the local stack only');

  test('the strip, a hit logged and paid, the strip on one line, the hit in Activity and on the record', async ({ browser }) => {
    test.setTimeout(180_000);
    endSeatOf(DEVANSH);
    liveHighHand(NAME);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000163');
    await expect(stripOf(floor).getByText('No hands paid tonight')).toBeVisible({ timeout: 15_000 });
    await seatOnFloor(floor, { table: 'Table 2', seat: 3, number: '9000000261' });
    // The seat's toast closed, so the log panel's picture shows the panel alone.
    await floor.getByRole('status').filter({ hasText: '9000000261 seated at Table 2, seat 3' }).getByRole('button', { name: 'Close', exact: true }).click();

    await logHit(floor, { hand: 'Four of a kind · 5,000', rank: { label: 'Four of', value: 'Jacks' }, pays: '5,000 Bonus to Devansh Malik now. Four Jacks', shot: 'console-log-panel-1440' });
    await expect(floor.getByText('5,000 Bonus paid to Devansh Malik for Four Jacks')).toBeVisible({ timeout: 10_000 });
    await expect(stripOf(floor).getByText('1 hand paid tonight')).toBeVisible();
    await expect(stripOf(floor).getByText(/^Last: Devansh Malik, Four Jacks, \d\d:\d\d$/)).toBeVisible();
    await shoot(floor, 'console-floor-strip-1440');
    // One balanced Bonus entry of 5,000 for him, under this promotion.
    expect(sql(`select string_agg(h.hand || ' ' || h.rank || ' ' || h.chips, ', ') from public.high_hand_hit h
                join public.promotion p on p.id = h.promotion_id where p.name = '${NAME}' and h.member_id = '${DEVANSH}'`)).toBe('four_of_a_kind jack 5000');

    // Five figures: still one line, at a desk and at tablet width.
    await logHit(floor, { hand: 'Royal flush · 25,000', pays: '25,000 Bonus to Devansh Malik now. Royal flush' });
    await expect(stripOf(floor).getByText('2 hands paid tonight')).toBeVisible({ timeout: 10_000 });
    await expect(stripOf(floor).getByText('30,000 Bonus')).toBeVisible();
    await expectOneLine(stripOf(floor));
    await floor.setViewportSize(VIEWPORT.tablet);
    await expectOneLine(stripOf(floor));
    await shoot(floor, 'console-floor-strip-tablet-1180');
    await floor.setViewportSize({ width: 820, height: 1180 });
    await expectOneLine(stripOf(floor));
    await shoot(floor, 'console-floor-strip-tablet-820');

    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000164', '/activity');
    const line = admin.getByRole('table', { name: 'Activity' }).getByRole('row').filter({ hasText: 'Four Jacks' }).first();
    await expect(line).toContainText('Farid Khan');
    await expect(line).toContainText('Paid a high hand: 5,000');
    await expect(line).toContainText('High hand · Devansh Malik');
    await expect(line).toContainText('Four Jacks · Table 2, seat 3');
    await shoot(admin, 'console-activity-1440');

    // The promotion's record has tonight's hits, and its Log a high hand opens the floor's panel.
    await admin.goto(`${appUrl('console')}/promotions`);
    await admin.getByRole('table', { name: 'Promotions' }).getByRole('row').filter({ hasText: NAME }).getByRole('button', { name: new RegExp(`^${NAME} `) }).click();
    const record = admin.getByRole('dialog', { name: NAME });
    await expect(record.getByText('Four Jacks · Table 2, seat 3')).toBeVisible();
    await expect(record.getByText('+25,000')).toBeVisible();
    await shoot(admin, 'console-record-paid-hits-1440');
    await record.getByRole('button', { name: 'Log a high hand' }).click();
    await expect(admin.getByRole('dialog', { name: 'Log a high hand' })).toBeVisible({ timeout: 10_000 });

    // Ended, and Devansh's seat with it, so no other flow meets them.
    endHighHands();
    endSeatOf(DEVANSH);
  });
});
