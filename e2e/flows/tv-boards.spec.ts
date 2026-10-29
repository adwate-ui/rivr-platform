/**
 * TV boards (#65; design prompt TV), signed in once on the console as a floor manager (Pooja Bansal,
 * this flow's own sign-in: Auth sends one code a minute to a number):
 * - a TV is paired on the waitlist board: each stake, its places as first name and initial;
 * - Kunal Mehra has hidden his name on the TVs in Profile (#326), so when the floor adds him to 50/100
 *   the TV shows "Player 1", never his name; he turns it back on and the TV shows "Kunal M.". Kunal is
 *   this flow's own member, as no other flow signs in as him;
 * - the floor adds Vihaan Kapoor to 50/100, and the TV shows "Vihaan K." within seconds, through
 *   Realtime and not its half-minute read;
 * - the console offers no jackpot board, and the TV shows no rupee; each board has its progress bar (#628);
 * - on the call-time board (decision 0163), the floor seats Nakul Dhillon in the Private Room, where call
 *   time is three hours (#634): the TV shows him at his table with the time left. Marked leaving, he is on the
 *   console's Leaving list and the TV shows his seat opening, within seconds. Given the promotions to turn
 *   to in between, the TV shows a promotion slide, then the call-time board again. Nakul is from the
 *   seed's hundred more members, whom no other flow seats; Pooja, an admin, lets him leave early, and he leaves.
 * Both leave the list and the TV is unpaired at the end.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const PLAYER = 'Vihaan Kapoor';
const HIDDEN = 'Kunal Mehra';
const LEAVING = 'Nakul Dhillon';

/** The console list for one game and stake, found by its heading. */
function gameList(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByRole('heading', { name }) })
    .filter({ has: page.getByRole('button', { name: 'Add to the list' }) }).last();
}

/** Pairs a TV on the console's TVs screen by the code it shows; the TV starts on the waitlist board. */
async function pairTv(tv: Page, floor: Page, name: string) {
  await tv.setViewportSize(VIEWPORT.display);
  await tv.goto(appUrl('display'));
  const shown = tv.getByRole('heading', { level: 2, name: /^\d{6}$/ });
  await expect(shown).toBeVisible();
  await floor.getByRole('link', { name: 'Devices', exact: true }).click();
  await floor.getByRole('link', { name: 'TVs' }).click();
  await floor.getByRole('textbox', { name: 'Code on the TV' }).fill((await shown.textContent()) ?? '');
  await floor.getByRole('textbox', { name: 'TV name' }).fill(name);
  await floor.getByRole('button', { name: 'Pair the TV' }).click();
  await expect(floor.getByText(`${name} is paired. It shows its mode within a few seconds.`)).toBeVisible();
}

/** Sets the member's "Show my name on the club's TVs" in Profile, whatever a run stopped early left it at. */
async function nameOnTvs(member: Page, isOn: boolean) {
  const choice = member.getByRole('switch', { name: 'Show my name on the club\'s TVs' });
  if ((await choice.getAttribute('aria-checked')) !== String(isOn)) await choice.click();
  await expect(choice).toHaveAttribute('aria-checked', String(isOn));
}

/** Takes a member off the console's lists, where a run stopped early may have left them. */
async function removeLeftover(floor: Page, name: string) {
  const remove = floor.getByRole('button', { name: `Remove ${name}` });
  if (await remove.count() > 0) await remove.first().click();
  await expect(remove).toHaveCount(0);
}

/** Adds a member to the console's 50/100 list by number. */
async function addToFifties(floor: Page, number: string, name: string) {
  await gameList(floor, 'NLH 50/100').getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await gameList(floor, 'NLH 50/100').getByRole('button', { name: 'Add to the list' }).click();
  await expect(floor.getByRole('button', { name: `Remove ${name}` })).toBeVisible();
}

/** Seats Nakul at the Private Room's seat 8, unless a run stopped early left him seated. */
async function seatNakul(floor: Page) {
  await floor.getByRole('link', { name: 'Live floor' }).click();
  await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();
  const move = floor.getByRole('button', { name: `Move ${LEAVING}` });
  await expect(floor.getByRole('heading', { name: 'Private Room' }).first()).toBeVisible();
  if (await move.count() === 0) {
    await floor.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '8', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Mobile number' }).fill('9000000400');
    await floor.getByRole('button', { name: 'Seat', exact: true }).click();
  }
  await expect(move).toBeVisible();
}

test.describe('TV boards', () => {
  test('TV boards: the waitlist by stake, a hidden name as its place, live as the floor adds players, and no rupee', async ({ browser }) => {
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
    const fifties = tv.getByRole('region', { name: 'NLH 50/100' });
    await expect(tv.getByRole('region', { name: 'NLH 100/200' })).toBeVisible();

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await expect(floor.getByRole('heading', { name: 'NLH 50/100' })).toBeVisible();
    await removeLeftover(floor, PLAYER);
    await removeLeftover(floor, HIDDEN);
    // Kunal first, on the empty 50/100 list: his place, never his name.
    await expect(fifties.getByText('No one waiting.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await addToFifties(floor, '9000000216', HIDDEN);
    await expect(fifties.getByText('Player 1', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(tv.getByText(/Kunal/)).toHaveCount(0);
    // Well inside the half-minute read: the signal reaches the TV through Realtime.
    await addToFifties(floor, '9000000212', PLAYER);
    await expect(fifties.getByText('Vihaan K.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(tv.getByText(PLAYER, { exact: true })).toHaveCount(0);
    // Turned back on, the TV names him again.
    await nameOnTvs(member, true);
    await expect(fifties.getByText('Kunal M.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(fifties.getByText('Player 1', { exact: true })).toHaveCount(0);

    await floor.getByRole('link', { name: 'Devices', exact: true }).click();

    await floor.getByRole('link', { name: 'TVs' }).click();
    // No jackpot to choose, and no rupee on the TV (#628).
    await expect(floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: 'Jackpot and high hand', exact: true }))
      .toHaveCount(0);
    await expect(tv.getByText(/₹/)).toHaveCount(0);

    // The call-time board: Nakul at his table with three hours to play, then his seat opening once he is marked leaving.
    const modes = floor.getByRole('group', { name: `What ${name} shows`, exact: true });
    await modes.getByRole('button', { name: 'Call-time board', exact: true }).click();
    await expect(tv.getByRole('heading', { level: 1, name: 'Call time' })).toBeVisible({ timeout: 15_000 });
    await seatNakul(floor);
    const room = tv.getByRole('region', { name: 'Private Room' });
    await expect(room.getByText('Nakul D.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(room.getByText(/^(3 h|2 h 59 min)$/)).toBeVisible();
    await floor.getByRole('button', { name: `${LEAVING} is leaving` }).click();
    await expect(floor.getByRole('heading', { name: 'Leaving', exact: true })).toBeVisible();
    await expect(floor.getByText('Private Room · seat 8', { exact: true })).toBeVisible();
    const openings = tv.getByRole('region', { name: 'Seats opening' });
    await expect(openings.getByText('Private Room · Seat 8', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(openings.getByText('Nakul D.', { exact: true })).toBeVisible();
    await expect(openings.getByText(/^In (3 h|2 h 59 min)$/)).toBeVisible();
    await expect(room.getByText('Nakul D.', { exact: true })).toHaveCount(0);

    // The promotions in between: after half a minute on the board, a promotion, and then the board again.
    await floor.getByRole('link', { name: 'Devices', exact: true }).click();
    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('group', { name: `What ${name} turns to in between`, exact: true }).getByRole('button', { name: 'Promotions', exact: true }).click();
    await expect(floor.getByRole('group', { name: `What ${name} turns to in between`, exact: true })
      .getByRole('button', { name: 'Promotions', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tv.getByText('Promotion', { exact: true })).toBeVisible({ timeout: 50_000 });
    await expect(tv.getByRole('heading', { level: 1, name: 'Call time' })).toBeVisible({ timeout: 60_000 });

    // Pooja, an admin, lets Nakul go before his call time, and he leaves.
    await floor.getByRole('link', { name: 'Live floor' }).click();
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();
    await floor.getByRole('button', { name: `Let ${LEAVING} leave early` }).first().click();
    await floor.getByRole('textbox', { name: 'Why they leave early' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Let leave early' }).click();
    await expect(floor.getByText('Early departure recorded. They can leave their seat.')).toBeVisible();
    await floor.getByRole('button', { name: `${LEAVING} leaves` }).click();
    await expect(floor.getByRole('button', { name: `Move ${LEAVING}` })).toHaveCount(0);

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await floor.getByRole('button', { name: `Remove ${PLAYER}` }).click();
    await floor.getByRole('button', { name: `Remove ${HIDDEN}` }).click();
    await floor.getByRole('link', { name: 'Devices', exact: true }).click();
    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
