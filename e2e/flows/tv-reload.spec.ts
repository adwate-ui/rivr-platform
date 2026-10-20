/**
 * @perf TV modes recover within 5 seconds of a reload (#66; additions "Performance budgets"): a
 * power cut costs a reload, not a reset. Signed in once on the console as a floor manager (Ritu
 * Malik, this flow's own sign-in: Auth sends one code a minute to a number), a TV is paired, then
 * put on each of the nine modes in turn; after each change the TV is reloaded and must show that
 * mode within five seconds. The TV is unpaired at the end.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const BUDGET = 5_000;

/** Each mode, by its chip on the console, and what shows the TV has rendered it. */
const MODES: readonly { chip: string; rendered: (tv: Page) => Locator }[] = [
  { chip: 'Waitlist board', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'Waitlist' }) },
  { chip: 'Call-time board', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'Call-time board' }) },
  { chip: 'Jackpot and high hand', rendered: (tv) => tv.getByText('High hand tonight', { exact: true }) },
  { chip: 'Tournament clock', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'Tournament clock' }) },
  // A live promotion's slide, or that none is running (#86).
  { chip: 'Promotions', rendered: (tv) => tv.getByText('Promotion', { exact: true }).or(tv.getByText('No promotions running.', { exact: true })) },
  { chip: 'Rewards ticker', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'Rewards ticker' }) },
  { chip: 'League leaderboard', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'League leaderboard' }) },
  { chip: 'Social wall', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'Social wall' }) },
  { chip: 'Spin wheel', rendered: (tv) => tv.getByRole('heading', { level: 1, name: 'Spin wheel' }) },
];

test.describe('TV reload', () => {
  test('@perf every TV mode is back within 5 seconds of a reload', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, so the local stack only');
    test.setTimeout(180_000);
    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const tv = await browser.newPage();
    await tv.setViewportSize(VIEWPORT.display);
    await tv.goto(appUrl('display'));
    const shown = tv.getByRole('heading', { level: 2, name: /^\d{6}$/ });
    await expect(shown).toBeVisible();
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000120');
    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('textbox', { name: 'Code on the TV' }).fill((await shown.textContent()) ?? '');
    await floor.getByRole('textbox', { name: 'TV name' }).fill(name);
    await floor.getByRole('button', { name: 'Pair the TV' }).click();
    await expect(tv.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeVisible({ timeout: 15_000 });
    const modes = floor.getByRole('group', { name: `What ${name} shows`, exact: true });

    for (const mode of MODES) {
      const chip = modes.getByRole('button', { name: mode.chip, exact: true });
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      const started = Date.now();
      await tv.reload();
      await expect(mode.rendered(tv), `${mode.chip} after a reload`).toBeVisible({ timeout: BUDGET });
      expect(Date.now() - started, `${mode.chip} within ${BUDGET} ms`).toBeLessThanOrEqual(BUDGET);
    }

    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
  });
});
