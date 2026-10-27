/**
 * The final-table stream's overlay (#125, decision 0256). Neha Batra, this flow's own floor manager,
 * makes a tournament from the RIVR Sunday template and starts its clock. The overlay opens as OBS opens
 * it, at /overlay?delay=20, and is paired as a TV on the tournament clock. Its page is transparent, and
 * it shows nothing until what it heard is 20 seconds old, then level 1. She moves the clock to level 2;
 * a TV would follow within seconds, but the overlay stays on level 1 for the delay, then moves. The
 * overlay is unpaired, and shows no pairing code on the stream, and the tournament is removed. The delay itself is proved in
 * apps/display's useDelayedTournament.test.ts.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const DELAY_SECONDS = 20;

/** Today in IST, as a date field takes it. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** The floor makes a tournament from the RIVR Sunday template, shown to members, and starts its clock. */
async function makeAndStart(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  await floor.getByRole('group', { name: 'Template' }).getByRole('button', { name: 'RIVR Sunday', exact: true }).click();
  await floor.getByRole('textbox', { name: 'Name' }).fill(name);
  await floor.getByLabel('Day', { exact: true }).fill(today());
  await floor.getByRole('textbox', { name: 'Start time' }).fill('16:00');
  await floor.getByRole('button', { name: 'Make tournament' }).click();
  await expect(floor.getByRole('region', { name: `${name} · level 1` })).toBeVisible();
  await floor.getByRole('button', { name: 'Start the clock' }).click();
  await expect(floor.getByRole('button', { name: 'Pause' })).toBeVisible();
}

/** Opens the overlay as OBS would, and pairs it on the console's TVs screen on the tournament clock. */
async function openAndPair(overlay: Page, floor: Page, tvName: string) {
  await overlay.setViewportSize(VIEWPORT.display);
  await overlay.goto(`${appUrl('display')}/overlay?delay=${DELAY_SECONDS}`);
  const shown = overlay.getByRole('heading', { level: 2, name: /^\d{6}$/ });
  await expect(shown).toBeVisible();
  await floor.getByRole('link', { name: 'TVs' }).click();
  await floor.getByRole('textbox', { name: 'Code on the TV' }).fill((await shown.textContent()) ?? '');
  await floor.getByRole('textbox', { name: 'TV name' }).fill(tvName);
  await floor.getByRole('button', { name: 'Pair the TV' }).click();
  await expect(floor.getByText(`${tvName} is paired. It shows its mode within a few seconds.`)).toBeVisible();
  const chip = floor.getByRole('group', { name: `What ${tvName} shows`, exact: true }).getByRole('button', { name: 'Tournament clock', exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  // Paired, the overlay leaves its code for its transparent page.
  await expect(overlay.getByRole('status')).toBeAttached({ timeout: 15_000 });
}

/** Back on Tournaments, the floor opens this tournament's clock unless it is already the one shown. */
async function openTournament(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  const open = floor.getByRole('button', { name: `Open ${name}` });
  await expect(open).toBeVisible();
  if (await open.isEnabled()) await open.click();
  await expect(floor.getByRole('region', { name: new RegExp(`^${name} · `) })).toBeVisible();
}

/** Removes the flow's tournament, so no other flow's Home finds one running. */
async function removeTournament(floor: Page, name: string) {
  await openTournament(floor, name);
  await floor.getByRole('button', { name: 'Remove', exact: true }).click();
  await floor.getByRole('button', { name: 'Remove it' }).click();
  await expect(floor.getByRole('button', { name: `Open ${name}` })).toHaveCount(0);
}

/** Waits for the overlay to show `level`, and says how long it took from `sinceMs`. */
async function overlayReaches(overlay: Page, level: string, sinceMs: number): Promise<number> {
  await expect(overlay.getByRole('heading', { level: 1, name: level })).toBeVisible({ timeout: 60_000 });
  return Date.now() - sinceMs;
}

async function runFlow(browser: Browser, floor: Page, name: string) {
  await makeAndStart(floor, name);
  const overlay = await browser.newPage();
  const tvName = `Stream ${name.slice(-5)}`;
  await openAndPair(overlay, floor, tvName);

  // OBS reloads the source once it is set up; the delay counts from what the reloaded page first heard.
  await overlay.reload();
  const openedAt = Date.now();
  await expect(overlay.getByRole('status')).toHaveText(`The clock shows ${DELAY_SECONDS} seconds behind the table. It starts once that delay has passed.`);
  const background = () => overlay.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(await background()).toBe('rgba(0, 0, 0, 0)');
  expect(await overlayReaches(overlay, 'Level 1', openedAt)).toBeGreaterThanOrEqual(DELAY_SECONDS * 1000);
  await expect(overlay.getByRole('region', { name })).toBeVisible();

  await openTournament(floor, name);
  await floor.getByRole('button', { name: 'Next level' }).click();
  const movedAt = Date.now();
  await expect(floor.getByRole('region', { name: `${name} · level 2` })).toBeVisible();
  await expect(overlay.getByRole('heading', { level: 1, name: 'Level 1' })).toBeVisible();
  expect(await overlayReaches(overlay, 'Level 2', movedAt)).toBeGreaterThanOrEqual(DELAY_SECONDS * 1000);

  await floor.getByRole('link', { name: 'TVs' }).click();
  await floor.getByRole('button', { name: `Unpair ${tvName}`, exact: true }).click();
  await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
  await floor.getByRole('button', { name: 'Unpair the TV' }).click();
  // Unpaired mid-stream, it never puts a pairing code on the stream: the clock goes and the page stays transparent.
  await expect(overlay.getByRole('region', { name })).toHaveCount(0, { timeout: 20_000 });
  await expect(overlay.getByRole('status')).toBeAttached();
  await expect(overlay.getByRole('heading', { name: 'Screen pairing' })).toHaveCount(0);
  expect(await background()).toBe('rgba(0, 0, 0, 0)');
}

test.describe('Stream overlay', () => {
  test('Stream overlay: the tournament clock on a transparent page, held back by the hole-card delay', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'runs a tournament and pairs a TV, so the local stack only');
    test.setTimeout(240_000);
    const name = `Stream flow ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000771');
    // A tournament left running would take Home's tournament card in every later flow, so it goes even after a failure.
    try {
      await runFlow(browser, floor, name);
    } catch (failure) {
      await removeTournament(floor, name).catch(() => undefined);
      throw failure;
    }
    await removeTournament(floor, name);
  });
});
