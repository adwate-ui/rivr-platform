/**
 * TV boards (#65; design prompt TV), signed in once on the console as a floor manager (Pooja Bansal,
 * this flow's own sign-in: Auth sends one code a minute to a number):
 * - a TV is paired on the waitlist board: each stake, its places as first name and initial;
 * - the floor adds Vihaan Kapoor to 50/100, and the TV shows "Vihaan K." within seconds, through
 *   Realtime and not its half-minute read;
 * - on the jackpot, the TV shows the bad-beat figure and tonight's high hand beneath it.
 * Vihaan leaves the list and the TV is unpaired at the end.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const PLAYER = 'Vihaan Kapoor';

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

test.describe('TV boards', () => {
  test('TV boards: the waitlist by stake, live as the floor adds a player, and the jackpot with tonight\'s high hand', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and changes the waitlist, so the local stack only');
    test.setTimeout(120_000);
    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000119');
    const tv = await browser.newPage();
    await pairTv(tv, floor, name);

    await expect(tv.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeVisible({ timeout: 15_000 });
    const fifties = tv.getByRole('region', { name: 'NLH 50/100' });
    await expect(tv.getByRole('region', { name: 'NLH 100/200' })).toBeVisible();
    await expect(fifties.getByText(PLAYER, { exact: true })).toHaveCount(0);

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await expect(floor.getByRole('heading', { name: 'NLH 50/100' })).toBeVisible();
    // A run stopped early may have left Vihaan on a list.
    const remove = floor.getByRole('button', { name: `Remove ${PLAYER}` });
    if (await remove.count() > 0) await remove.first().click();
    await expect(remove).toHaveCount(0);
    await gameList(floor, 'NLH 50/100').getByRole('textbox', { name: 'Mobile number' }).fill('9000000212');
    await gameList(floor, 'NLH 50/100').getByRole('button', { name: 'Add to the list' }).click();
    await expect(floor.getByRole('button', { name: `Remove ${PLAYER}` })).toBeVisible();
    // Well inside the half-minute read: the signal reaches the TV through Realtime.
    await expect(fifties.getByText('Vihaan K.', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(tv.getByText(PLAYER, { exact: true })).toHaveCount(0);

    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: 'Jackpot and high hand', exact: true }).click();
    await expect(tv.getByText('Bad-beat jackpot', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByText(/^₹[\d,]+$/)).toBeVisible();
    await expect(tv.getByText('High hand tonight', { exact: true })).toBeVisible();

    await floor.getByRole('link', { name: 'Waitlist' }).click();
    await floor.getByRole('button', { name: `Remove ${PLAYER}` }).click();
    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
