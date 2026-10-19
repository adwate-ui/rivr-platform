/**
 * @perf Tap to confirm under 100 ms on the dealer tablet (#46; additions "Performance budgets";
 * decision 0055). The page's CPU is slowed to stand in for an Android dealer tablet: four times
 * slower than the reference machine, calibrated on each host, so a slower CI runner is slowed less.
 * Signed in on the console as its own duty manager (Auth sends one code a minute to a number), the
 * flow pairs a tablet at Table 3 and Pema signs in. After one hand to warm up, each Log hand is timed
 * in the page, from the press to the next frame drawn with "Hands this down" counting the hand, which
 * happens on the tablet before the hand is sent (#43). The tablet is revoked at the end.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

const BUDGET_MS = 100;
const HANDS = 5;
// The benchmark below takes this long, unthrottled, on the reference machine (decision 0055); the
// tablet is taken to be four times slower than it.
const REFERENCE_MS = 12.7;
const TABLET_SLOWDOWN = 4;

/** A fixed piece of work at full speed, the fastest of three: how fast this host's page runs. */
async function benchmarkMs(tablet: Page): Promise<number> {
  return tablet.evaluate(() => {
    const times: number[] = [];
    let total = 0;
    for (let run = 0; run < 3; run += 1) {
      const started = performance.now();
      for (let i = 0; i < 5_000_000; i += 1) total = (total + i * 7) % 1_000_003;
      times.push(performance.now() - started);
    }
    return Math.min(...times) + (total < 0 ? 1 : 0);
  });
}

/** Starts timing the next press: resolved, on window, with the milliseconds until the frame that shows `count` hands. */
async function timeNextTap(tablet: Page, count: number) {
  await tablet.evaluate((expected) => {
    const confirmed = new Promise<number>((resolve) => {
      let pressedAt = 0;
      window.addEventListener('pointerdown', (event) => { pressedAt = event.timeStamp; }, { capture: true, once: true });
      const observer = new MutationObserver(() => {
        if (pressedAt === 0 || !document.body.innerText.includes(expected)) return;
        observer.disconnect();
        requestAnimationFrame(() => resolve(performance.now() - pressedAt));
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    Reflect.set(window, 'rivrConfirmed', confirmed);
  }, `Hands this down: ${count}`);
}

/** Logs a ₹48,000 hand once the last one has reached the database, so the count does not dip mid-tap. */
async function logHand(tablet: Page, logged: number, timed: boolean): Promise<number | null> {
  await expect(tablet.getByText(/ · queued$/)).toHaveCount(0);
  await expect(tablet.getByText(`Hands this down: ${logged}`)).toBeVisible();
  await press(tablet, ['4', '8', '000']);
  if (timed) await timeNextTap(tablet, logged + 1);
  await tablet.getByRole('button', { name: 'Log hand' }).click();
  return timed ? tablet.evaluate(() => Reflect.get(window, 'rivrConfirmed')) : null;
}

test.describe('Tablet tap to confirm', () => {
  test('@perf Log hand confirms within 100 ms on a slowed CPU', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and logs hands, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000123');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    const rate = Math.max(1, (TABLET_SLOWDOWN * REFERENCE_MS) / (await benchmarkMs(tablet)));
    const cdp = await tablet.context().newCDPSession(tablet);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });

    await logHand(tablet, 0, false);
    const times: number[] = [];
    for (let hand = 1; hand <= HANDS; hand += 1) {
      const ms = await logHand(tablet, hand, true);
      if (ms !== null) times.push(ms);
    }
    test.info().annotations.push({ type: 'tap to confirm (ms)', description: `${times.map((ms) => ms.toFixed(1)).join(', ')} at ${rate.toFixed(1)}x` });
    expect(Math.max(...times), `slowest of ${times.map((ms) => Math.round(ms)).join(', ')} ms at ${rate.toFixed(1)}x`).toBeLessThan(BUDGET_MS);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await expect(tablet.getByText(`Hands this down: ${HANDS + 1}`)).toBeVisible();
    await revoke(floor, name);
  });
});
