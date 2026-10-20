/**
 * TV boards (#65; design prompt TV), signed in once on the console as a floor manager (Pooja Bansal,
 * this flow's own sign-in: Auth sends one code a minute to a number):
 * - a TV is paired on the waitlist board: each stake, its places as first name and initial;
 * - Kunal Mehra has hidden his name on the TVs in Profile (#326), so when the floor adds him to 50/100
 *   the TV shows "Player 1", never his name; he turns it back on and the TV shows "Kunal M.". Kunal is
 *   this flow's own member, as no other flow signs in as him;
 * - the floor adds Vihaan Kapoor to 50/100, and the TV shows "Vihaan K." within seconds, through
 *   Realtime and not its half-minute read;
 * - on the jackpot, the TV shows the bad-beat figure and tonight's high hand beneath it.
 * Both leave the list and the TV is unpaired at the end.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const PLAYER = 'Vihaan Kapoor';
const HIDDEN = 'Kunal Mehra';

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

test.describe('TV boards', () => {
  test('TV boards: the waitlist by stake, a hidden name as its place, live as the floor adds players, and the jackpot', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and changes the waitlist, so the local stack only');
    test.setTimeout(150_000);
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

    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: 'Jackpot and high hand', exact: true }).click();
    await expect(tv.getByText('Bad-beat jackpot', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByText(/^₹[\d,]+$/)).toBeVisible();
    await expect(tv.getByText('High hand tonight', { exact: true })).toBeVisible();

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await floor.getByRole('button', { name: `Remove ${PLAYER}` }).click();
    await floor.getByRole('button', { name: `Remove ${HIDDEN}` }).click();
    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
