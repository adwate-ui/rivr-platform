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
 * - on the call-time board (decision 0163), the floor seats Nakul Dhillon in the Private Room, where call
 *   time is three hours (#634): the TV shows him at his table with the time left. Marked leaving, he is among the
 *   console's requests and the TV shows his seat opening, within seconds. Given the promotions to turn
 *   to in between, the TV shows a promotion slide, then the call-time board again. Nakul is from the
 *   seed's hundred more members, whom no other flow seats; Pooja, an admin, lets him leave early, and he leaves.
 * Both leave the list and the TV is unpaired at the end.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { letGoEarly, requestsPanel, seatOnFloor, showSeats, tableTile } from '../support/floor.ts';
import { openConsole } from '../support/console.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const PLAYER = 'Vihaan Kapoor';
const HIDDEN = 'Kunal Mehra';
const LEAVING = 'Nakul Dhillon';

/** The console's card for one table's list (decision 0467), found by its heading (console v3). */
function gameList(page: Page, name: string): Locator {
  // The card is the innermost section that holds the heading; the screen's own section holds every card.
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) }).last();
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
  await gameList(floor, 'Table 1').getByRole('textbox', { name: 'Add: mobile or member number' }).fill(number);
  await gameList(floor, 'Table 1').getByRole('button', { name: 'Add', exact: true }).click();
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

test.describe('TV boards', () => {
  test('TV boards: the waitlist a list a table, a hidden name as its place, live as the floor adds players, and no rupee', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and changes the waitlist, so the local stack only');
    test.setTimeout(240_000);
    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000216');
    await member.getByRole('link', { name: 'Profile' }).click();
    await nameOnTvs(member, false);

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000119');
    const tv = await browser.newPage();
    await pairTv(tv, floor, name);

    await expect(tv.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeVisible({ timeout: 15_000 });
    // The bar along the foot fills over the board's half minute, so the board reads as live (#628).
    await expect(tv.locator('[data-board-progress]')).toHaveCount(1);
    // A table has a column only while someone waits for it (F-140).
    const fifties = tv.getByRole('region', { name: 'Table 1', exact: true });

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await expect(floor.getByRole('heading', { name: 'Table 1', exact: true })).toBeVisible();
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

    // The call-time board: Nakul at his table with three hours to play, then his seat opening once he says he is leaving, from
    // his seat in the app (the console's Mark leaving is hidden, decision 0299).
    const modes = floor.getByRole('radiogroup', { name: `What ${name} shows`, exact: true });
    await modes.getByRole('radio', { name: 'Call-time board', exact: true }).click();
    await expect(tv.getByRole('heading', { level: 1, name: 'Call time' })).toBeVisible({ timeout: 15_000 });
    await seatNakul(floor);
    const room = tv.getByRole('region', { name: 'Private Room' });
    await expect(room.getByText('Nakul D.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(room.getByText(/^(3h 00m|2h 59m)$/)).toBeVisible();
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
    const openings = tv.getByRole('region', { name: 'Seats opening' });
    await expect(openings.getByText('Private Room · Seat 8', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(openings.getByText('Nakul D.', { exact: true })).toBeVisible();
    await expect(openings.getByText(/^In (3h 00m|2h 59m)$/)).toBeVisible();
    await expect(room.getByText('Nakul D.', { exact: true })).toHaveCount(0);

    // The promotions in between: after half a minute on the board, a promotion, and then the board again.
    // TVs are a part of Settings' Devices tab (console v3), opened by address once sign-in is through.
    await openConsole(floor, '/settings?tab=tvs');
    await floor.getByRole('group', { name: `What ${name} turns to in between`, exact: true }).getByRole('button', { name: 'Promotions', exact: true }).click();
    await expect(floor.getByRole('group', { name: `What ${name} turns to in between`, exact: true })
      .getByRole('button', { name: 'Promotions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tv.getByText('Promotion', { exact: true })).toBeVisible({ timeout: 50_000 });
    await expect(tv.getByRole('heading', { level: 1, name: 'Call time' })).toBeVisible({ timeout: 60_000 });

    // Pooja, an admin, lets Nakul go before his call time, and he leaves.
    await floor.getByRole('link', { name: 'Live floor' }).click();
    await letGoEarly(floor, LEAVING, 'Floor decision');
    await expect(floor.getByRole('button', { name: new RegExp(`^Seat \\d+, ${LEAVING},`) })).toHaveCount(0);

    await floor.goto(`${appUrl('console')}/waitlist`);
    await removePlace(floor, PLAYER);
    await removePlace(floor, HIDDEN);
    // TVs are a part of Settings' Devices tab (console v3), opened by address once sign-in is through.
    await openConsole(floor, '/settings?tab=tvs');
    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
