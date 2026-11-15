/**
 * TV boards (#65; design prompt TV), signed in once on the console as a floor manager (Pooja Bansal,
 * this flow's own sign-in: Auth sends one code a minute to a number):
 * - a TV is paired on the waitlist board: a list a table (decision 0467), its places as first name and initial;
 * - Kunal Mehra has hidden his name on the TVs in Profile (#326), so when the floor adds him to Table 1's list
 *   the TV shows his place with the name left blank (F-137); he turns it back on and the TV shows "Kunal M.". Kunal is
 *   this flow's own member, as no other flow signs in as him;
 * - the floor adds Vihaan Kapoor to Table 1's list, and the TV shows "Vihaan K." within seconds, through
 *   Realtime and not its half-minute read;
 * - the console offers no jackpot board, and the TV shows no rupee; each board has its progress bar (#628);
 * - the club's notice, put up in Settings, runs along the foot of the board, and is gone once ended (redesign RD-28);
 * - on the call-time board (decision 0163), titled Seats opening, the floor seats Nakul Dhillon in the Private Room, where
 *   call time is three hours (#634): the TV lists his seat with the time left. Marked leaving, he is among the console's
 *   requests, and his seat stays on the TV's one list with the call time he still owes. In Settings, TVs, Rotation (redesign RD-28)
 *   Pooja types the seconds on each board; given the high hand bonus and the promotions to turn to in between, the TV
 *   passes over the high hand bonus, which has nothing to show, shows a promotion slide, then Seats opening again; with
 *   the promotions switched off under Boards shown it stays on Seats opening, and they are switched on again. Nakul is from the
 *   seed's hundred more members, whom no other flow seats; Pooja, an admin, lets him leave early, and he leaves;
 * - with a high hand running and its board as the TV's own (redesign RD-25), the TV shows the hands with their Bonus and
 *   the rules, and the four Jacks Pooja logs for Nakul from the Live floor are on it within seconds, through Realtime.
 * Both leave the list and the TV is unpaired at the end.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { letGoEarly, requestsPanel, seatOnFloor, showSeats, tableTile } from '../support/floor.ts';
import { openConsole } from '../support/console.ts';
import { endHighHands, liveHighHand, shoot } from '../support/highHand.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const PLAYER = 'Vihaan Kapoor';
const HIDDEN = 'Kunal Mehra';
const LEAVING = 'Nakul Dhillon';

/** Changes one of Settings' Rotation rules from now: opens its panel from its row, lets `change` type in it, saves and closes. */
async function saveRotation(page: Page, setting: string, change: (panel: Locator) => Promise<void>) {
  await page.getByRole('button', { name: `Change ${setting}`, exact: true }).click();
  const panel = page.getByRole('dialog', { name: setting });
  await change(panel);
  await panel.getByRole('textbox', { name: 'Reason' }).fill('TV boards flow');
  await panel.getByRole('button', { name: 'Save change' }).click();
  await expect(panel.getByText('Change saved.')).toBeVisible();
  await panel.getByRole('button', { name: 'Close' }).click();
}

/** Puts a notice up in Settings, Notices, as the Notices flow does. */
async function putUpNotice(floor: Page, words: string) {
  await openConsole(floor, '/settings?tab=notices');
  await floor.getByRole('button', { name: 'New notice' }).click();
  await floor.getByRole('textbox', { name: 'Notice' }).fill(words);
  await floor.getByRole('button', { name: 'Put up' }).click();
  await expect(floor.getByRole('status').getByText('Notice put up.')).toBeVisible();
}

/** Ends that notice again, asked first. */
async function endNotice(floor: Page, words: string) {
  await floor.getByRole('button', { name: `End the notice: ${words}` }).click();
  await floor.getByRole('button', { name: 'Yes, end it' }).click();
  await expect(floor.getByRole('status').getByText('Notice ended.')).toBeVisible();
}

/** The club's notice along the foot of the TV's board (redesign RD-28): there once put up, the TV reading it as it loads; gone once ended. */
async function noticeOnTheFoot(tv: Page, floor: Page) {
  const words = `Table 4 opens at 9 tonight (${String(Date.now())}).`;
  await putUpNotice(floor, words);
  await tv.reload();
  await expect(tv.getByText(words, { exact: true })).toBeVisible({ timeout: 15_000 });
  await endNotice(floor, words);
  await tv.reload();
  await expect(tv.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeVisible({ timeout: 15_000 });
  await expect(tv.getByText(words, { exact: true })).toHaveCount(0);
}

/** Takes a member's place off the lists from its ⋯ menu, asked first (decision 0469). */
async function removePlace(floor: Page, name: string) {
  await floor.getByRole('button', { name: `More for ${name}`, exact: true }).first().click();
  await floor.getByRole('menuitem', { name: 'Remove from list' }).click();
  await floor.getByRole('button', { name: `Yes, remove ${name}` }).click();
}

/** Pairs a TV on the console's TVs screen by the code it shows; the TV starts on the waitlist board. */
async function pairTv(tv: Page, floor: Page, name: string) {
  await tv.setViewportSize(VIEWPORT.display);
  await tv.goto(appUrl('display'));
  const shown = tv.getByRole('heading', { level: 2, name: /^\d{6}$/ });
  await expect(shown).toBeVisible();
  // TVs are a part of Settings' Devices tab (console v3), opened by address once sign-in is through.
  await openConsole(floor, '/settings?tab=tvs');
  await floor.getByRole('button', { name: 'Add a TV' }).click();
  await floor.getByRole('textbox', { name: 'Code on the TV' }).fill((await shown.textContent()) ?? '');
  await floor.getByRole('textbox', { name: 'TV name' }).fill(name);
  await floor.getByRole('button', { name: 'Pair the TV' }).click();
  await expect(floor.getByText(`${name} is paired.`)).toBeVisible();
}

/** Sets the member's "Name on club TVs" in Profile (decision 0320), whatever a run stopped early left it at. */
async function nameOnTvs(member: Page, isOn: boolean) {
  const choice = member.getByRole('switch', { name: 'Name on club TVs' });
  if ((await choice.getAttribute('aria-checked')) !== String(isOn)) await choice.click();
  await expect(choice).toHaveAttribute('aria-checked', String(isOn));
}

/** Takes a member off the console's lists, where a run stopped early may have left them. */
async function removeLeftover(floor: Page, name: string) {
  const menu = floor.getByRole('button', { name: `More for ${name}`, exact: true });
  if (await menu.count() > 0) await removePlace(floor, name);
  await expect(menu).toHaveCount(0);
}

/** Adds a member to the console's Table 1 list (50/100) by number. */
async function addToFifties(floor: Page, number: string, name: string) {
  await floor.getByRole('button', { name: 'Add to a list' }).click();
  const panel = floor.getByRole('dialog', { name: 'Add to a list' });
  await panel.getByRole('textbox', { name: 'Add: mobile or member number' }).fill(number);
  await panel.getByRole('radiogroup', { name: 'Table' }).getByRole('radio', { name: 'Table 1', exact: true }).click();
  await panel.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(floor.getByRole('button', { name: `More for ${name}`, exact: true })).toBeVisible();
}

/** Seats Nakul at the Private Room's seat 8 from the Live floor (console v3), unless a run stopped early left him seated. */
async function seatNakul(floor: Page) {
  await floor.getByRole('link', { name: 'Live floor' }).click();
  await showSeats(floor);
  const seated = tableTile(floor, 'Private Room').getByRole('button', { name: new RegExp(`^Seat 8, ${LEAVING},`) });
  if (await seated.count() === 0) await seatOnFloor(floor, { table: 'Private Room', seat: 8, number: '9000000400' });
  await expect(seated).toBeVisible();
}

/**
 * The High hand bonus board as the TV's own (redesign RD-25): with a high hand running it shows the hands with their Bonus
 * and the rules; the hit Pooja logs for Nakul from the Live floor's strip is on it within seconds, through Realtime.
 */
async function highHandOnItsBoard(tv: Page, floor: Page, name: string) {
  liveHighHand(`High hand bonus ${String(Date.now() % 100_000)}`);
  await floor.getByRole('radiogroup', { name: `What ${name} shows`, exact: true }).getByRole('radio', { name: 'High hand bonus', exact: true }).click();
  await expect(tv.getByRole('heading', { level: 1, name: 'High hand bonus' })).toBeVisible({ timeout: 40_000 });
  const hands = tv.getByRole('region', { name: 'Hit one, get paid' });
  await expect(hands.getByRole('listitem').filter({ hasText: 'Royal flush' })).toContainText('25,000');
  await expect(hands.getByText('Both hole cards must play · Shown at showdown · 4 or more players dealt in')).toBeVisible();
  await floor.getByRole('link', { name: 'Live floor' }).click();
  await floor.getByRole('region', { name: 'High hand bonus' }).getByRole('button', { name: 'Log a high hand' }).click();
  const panel = floor.getByRole('dialog', { name: 'Log a high hand' });
  await panel.getByRole('radio', { name: 'Private Room' }).click();
  await panel.getByRole('radio', { name: LEAVING }).click();
  await panel.getByRole('radio', { name: 'Four of a kind · 5,000' }).click();
  await panel.getByRole('radiogroup', { name: 'Four of' }).getByRole('radio', { name: 'Jacks' }).click();
  for (const rule of ['Both hole cards played', 'Shown at showdown', '4 or more players dealt in']) await panel.getByRole('switch', { name: rule }).click();
  await panel.getByRole('button', { name: 'Pay 5,000 Bonus' }).click();
  const paid = tv.getByRole('region', { name: 'Paid tonight' }).getByRole('listitem').filter({ hasText: 'Nakul D.' });
  await expect(paid).toContainText(/Four Jacks · Private Room · \d\d:\d\d/, { timeout: 40_000 });
  await expect(paid).toContainText('5,000');
  await shoot(tv, 'tv-high-hand-board-on-the-stage-1920');
  endHighHands();
}

test.describe('TV boards', () => {
  test('TV boards: the waitlist a list a table, a hidden name as its place, live as the floor adds players, and no rupee', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and changes the waitlist, so the local stack only');
    test.setTimeout(330_000);
    // No high hand a cut-off run left running: the rotation below passes over a board with nothing to show.
    endHighHands();
    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000216');
    await member.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Profile' }).click();
    await nameOnTvs(member, false);

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000119');
    const tv = await browser.newPage();
    await pairTv(tv, floor, name);

    await expect(tv.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeVisible({ timeout: 15_000 });
    // The bar along the foot fills over the board's half minute, so the board reads as live (#628).
    await expect(tv.locator('[data-board-progress]')).toHaveCount(1);
    await noticeOnTheFoot(tv, floor);
    // A table has a column only while someone waits for it (F-140).
    const fifties = tv.getByRole('region', { name: 'Table 1', exact: true });

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await expect(floor.getByRole('table', { name: 'Places' }).or(floor.getByText('No one is waiting.')).first()).toBeVisible();
    await removeLeftover(floor, PLAYER);
    await removeLeftover(floor, HIDDEN);
    // Kunal first, on Table 1's empty list: his place, never his name.
    await expect(fifties).toHaveCount(0, { timeout: 25_000 });
    await addToFifties(floor, '9000000216', HIDDEN);
    await expect(fifties.getByText('1', { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(tv.getByText(/Kunal/)).toHaveCount(0);
    // Well inside the half-minute read: the signal reaches the TV through Realtime.
    await addToFifties(floor, '9000000212', PLAYER);
    await expect(fifties.getByText('Vihaan K.', { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(tv.getByText(PLAYER, { exact: true })).toHaveCount(0);
    // Turned back on, the TV names him again.
    await nameOnTvs(member, true);
    await expect(fifties.getByText('Kunal M.', { exact: true })).toBeVisible({ timeout: 25_000 });

    // TVs are a part of Settings' Devices tab (console v3), opened by address once sign-in is through.

    await openConsole(floor, '/settings?tab=tvs');
    // No jackpot to choose, and no rupee on the TV (#628).
    await expect(floor.getByRole('radiogroup', { name: `What ${name} shows`, exact: true }).getByRole('radio', { name: 'Jackpot and high hand', exact: true }))
      .toHaveCount(0);
    await expect(tv.getByText(/₹/)).toHaveCount(0);

    // The call-time board: Nakul's seat with three hours to play, before and after he says he is leaving, from his seat in the
    // app (the console's Mark leaving is hidden, decision 0299).
    const modes = floor.getByRole('radiogroup', { name: `What ${name} shows`, exact: true });
    await modes.getByRole('radio', { name: 'Call-time board', exact: true }).click();
    await expect(tv.getByRole('heading', { level: 1, name: 'Seats opening' })).toBeVisible({ timeout: 15_000 });
    await seatNakul(floor);
    const seat = tv.getByRole('listitem').filter({ hasText: 'Nakul D.' });
    await expect(seat.getByText('Private Room · seat 8', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(seat.getByText(/^(3 h|2 h 5\d min)$/)).toBeVisible();
    const nakul = await (await browser.newContext()).newPage();
    await signInToPlayer(nakul, '9000000400');
    // Tonight › Leaving list: Leave seat asks first, as call time is owed (decision 0320).
    await nakul.getByRole('button', { name: 'Leave seat' }).click();
    await nakul.getByRole('dialog', { name: 'Leave your seat?' }).getByRole('button', { name: 'Join leaving list' }).click();
    // Leaving is one of the requests docked beside the Live floor (console v3, decision 0479).
    const leaving = requestsPanel(floor).locator('div').filter({ has: floor.getByRole('button', { name: LEAVING, exact: true }) })
      .filter({ hasText: /^Leaving/ }).last();
    await expect(leaving).toBeVisible({ timeout: 20_000 });
    await expect(leaving).toContainText('Private Room, seat 8');
    // Leaving or not, his seat is on the board's one list, with the call time he still owes.
    await expect(seat.getByText('Private Room · seat 8', { exact: true })).toBeVisible();
    await expect(seat.getByText(/^(3 h|2 h 5\d min)$/)).toBeVisible();

    // Settings, TVs, Rotation (redesign RD-28): the seconds on each board, typed. TVs are a part of Settings (console v3).
    await openConsole(floor, '/settings?tab=tvs');
    await saveRotation(floor, 'Time on each board', async (panel) => {
      await panel.getByRole('textbox', { name: 'Call time' }).fill('8');
      await panel.getByRole('textbox', { name: 'Promotions' }).fill('5');
    });
    // The high hand bonus and the promotions in between: the TV passes over the high hand bonus, which has nothing to show,
    // and after eight seconds on the board shows a promotion, and then the board again.
    const turns = floor.getByRole('group', { name: `What ${name} turns to in between`, exact: true });
    await turns.getByRole('button', { name: 'High hand bonus', exact: true }).click();
    await expect(turns.getByRole('button', { name: 'High hand bonus', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await turns.getByRole('button', { name: 'Promotions', exact: true }).click();
    await expect(turns.getByRole('button', { name: 'Promotions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tv.getByText('Offer', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(tv.getByRole('heading', { level: 1, name: 'High hand bonus' })).toHaveCount(0);
    await expect(tv.getByRole('heading', { level: 1, name: 'Seats opening' })).toBeVisible({ timeout: 30_000 });
    // Boards shown: the promotions switched off show on no TV, so this one stays on Seats opening; then on again.
    await saveRotation(floor, 'Boards shown', async (panel) => panel.getByRole('switch', { name: 'Promotions' }).click());
    await expect(tv.getByRole('heading', { level: 1, name: 'Seats opening' })).toBeVisible({ timeout: 15_000 });
    await tv.waitForTimeout(12_000);
    await expect(tv.getByText('Offer', { exact: true })).toHaveCount(0);
    await expect(tv.getByRole('heading', { level: 1, name: 'Seats opening' })).toBeVisible();
    await saveRotation(floor, 'Boards shown', async (panel) => panel.getByRole('switch', { name: 'Promotions' }).click());

    await highHandOnItsBoard(tv, floor, name);

    // Pooja, an admin, lets Nakul go before his call time, and he leaves.
    await floor.getByRole('link', { name: 'Live floor' }).click();
    await letGoEarly(floor, LEAVING, 'Floor decision');
    await expect(floor.getByRole('button', { name: new RegExp(`^Seat \\d+, ${LEAVING},`) })).toHaveCount(0);

    await floor.goto(`${appUrl('console')}/waitlist`);
    await removePlace(floor, PLAYER);
    await removePlace(floor, HIDDEN);
    // TVs are a part of Settings' Devices tab (console v3), opened by address once sign-in is through.
    await openConsole(floor, '/settings?tab=tvs');
    await floor.getByRole('button', { name: `More for ${name}`, exact: true }).click();
    await floor.getByRole('menuitem', { name: 'Unpair', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
