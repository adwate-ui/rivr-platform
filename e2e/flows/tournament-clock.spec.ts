/**
 * Flow 10, the tournament clock (#119; decision 0201). Vikram Bedi, this flow's own floor manager, makes
 * a tournament from the RIVR Sunday template on the console and starts its clock, then moves it a level
 * at a time to level 7, 400/800 ante 800, as in the design prompt (the break after level 4 on the way).
 * He pairs a TV on the tournament clock, which shows level 7; Sara Gill, this flow's own member, sees it
 * on Home. The design prompt's "+20 min" is the floor's Next level here: the TV moves to level 8,
 * 500/1,000 ante 1,000, within seconds, and so does Sara's Home. The clock is the server's, so the TV and
 * the phone read it again on reload. The TV is unpaired and the tournament removed at the end. How the
 * clock runs, pauses and moves is proved in supabase/tests/103 and on the golden file tournamentClock.json.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Today in IST, as a date field takes it. */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** The floor makes a tournament from the RIVR Sunday template, shown to members, and starts its clock. */
async function makeAndStart(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Tournaments' }).click();
  await expect(floor.getByRole('heading', { name: 'Tournaments', level: 1 })).toBeVisible();
  await floor.getByRole('group', { name: 'Template' }).getByRole('button', { name: 'RIVR Sunday', exact: true }).click();
  await floor.getByRole('textbox', { name: 'Name' }).fill(name);
  await floor.getByLabel('Day', { exact: true }).fill(today());
  await floor.getByRole('textbox', { name: 'Start time' }).fill('16:00');
  await floor.getByRole('button', { name: 'Make tournament' }).click();
  await expect(floor.getByText(`${name} is on the list.`)).toBeVisible();
  await expect(floor.getByRole('region', { name: `${name} · level 1` })).toBeVisible();
  await floor.getByRole('button', { name: 'Start the clock' }).click();
  await expect(floor.getByRole('button', { name: 'Pause' })).toBeVisible();
}

/** Next level, once for each stage, until level 7: the break after level 4 is a stage of its own. */
async function moveToLevelSeven(floor: Page, name: string) {
  for (const stage of ['level 2', 'level 3', 'level 4', 'break after level 4', 'level 5', 'level 6', 'level 7']) {
    await floor.getByRole('button', { name: 'Next level' }).click();
    await expect(floor.getByRole('region', { name: `${name} · ${stage}` })).toBeVisible();
  }
  await expect(floor.getByText('400/800 ante 800', { exact: true })).toBeVisible();
  await expect(floor.getByText('Next 500/1,000 ante 1,000')).toBeVisible();
}

/** Pairs a TV on the console's TVs screen by the code it shows, on the tournament clock. */
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
  await floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: 'Tournament clock', exact: true }).click();
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

/** What the TV's clock shows at a level: the level, then its blinds and ante. */
async function expectTvAt(tv: Page, level: string, blinds: string, ante: string) {
  await expect(tv.getByRole('heading', { level: 1, name: level })).toBeVisible({ timeout: 20_000 });
  await expect(tv.getByText(blinds, { exact: true })).toBeVisible();
  await expect(tv.getByText(ante, { exact: true })).toBeVisible();
}

/** Unpairs the flow's TV on the console's TVs screen. */
async function unpairTv(floor: Page, tvName: string) {
  await floor.getByRole('link', { name: 'Devices', exact: true }).click();
  await floor.getByRole('link', { name: 'TVs' }).click();
  await floor.getByRole('button', { name: `Unpair ${tvName}`, exact: true }).click();
  await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
  await floor.getByRole('button', { name: 'Unpair the TV' }).click();
}

/** The flow itself: the clock to level 7, the TV and Home there, Next level, both at level 8, and the TV unpaired. */
async function runFlow(browser: Browser, floor: Page, name: string) {
  await makeAndStart(floor, name);
  await moveToLevelSeven(floor, name);

  const tv = await browser.newPage();
  const tvName = `Clock ${name.slice(-5)}`;
  await pairTv(tv, floor, tvName);
  await expectTvAt(tv, 'Level 7', '400/800', 'Ante 800');
  await expect(tv.getByText(name)).toBeVisible();

  const member = await browser.newPage();
  await signInToPlayer(member, '9000000751');
  await expect(member.getByText(`${name} · Level 7`)).toBeVisible({ timeout: 10_000 });
  await expect(member.getByText('400/800 ante 800')).toBeVisible();

  await openTournament(floor, name);
  await floor.getByRole('button', { name: 'Next level' }).click();
  await expect(floor.getByRole('region', { name: `${name} · level 8` })).toBeVisible();
  await expectTvAt(tv, 'Level 8', '500/1,000', 'Ante 1,000');
  // Home moves on its own: it reads the clock again every half minute.
  await expect(member.getByText(`${name} · Level 8`)).toBeVisible({ timeout: 40_000 });
  await expect(member.getByText('500/1,000 ante 1,000')).toBeVisible();
  await tv.reload();
  await expectTvAt(tv, 'Level 8', '500/1,000', 'Ante 1,000');
  await unpairTv(floor, tvName);
}

test.describe('Tournament clock', () => {
  test('Tournament: the floor moves the clock on, and the TV clock and the player’s tournament card move to level 8', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'runs a tournament and pairs a TV, so the local stack only');
    test.setTimeout(180_000);
    const name = `Flow ten ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000750');
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
