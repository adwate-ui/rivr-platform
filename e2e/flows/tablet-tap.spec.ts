/**
 * @perf Tap to confirm under 100 ms on the dealer tablet (#46; additions "Performance budgets"). The
 * page's CPU runs four times slower, Lighthouse's mid-range mobile setting, for an Android dealer
 * tablet. Signed in on the console as its own duty manager (Auth sends one code a minute to a number),
 * the flow pairs a tablet at Table 3 and Pema signs in. Each Log hand is timed in the page, from the
 * press to "Hands this down" counting the hand, which happens on the tablet before the hand is sent
 * (#43). The tablet is revoked at the end.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

const BUDGET_MS = 100;
const HANDS = 5;

/** Starts timing the next press: resolved, on window, with the milliseconds until the tablet shows `count` hands. */
async function timeNextTap(tablet: Page, count: number) {
  await tablet.evaluate((expected) => {
    const confirmed = new Promise<number>((resolve) => {
      let pressedAt = 0;
      window.addEventListener('pointerdown', (event) => { pressedAt = event.timeStamp; }, { capture: true, once: true });
      const observer = new MutationObserver(() => {
        if (pressedAt === 0 || !document.body.innerText.includes(expected)) return;
        observer.disconnect();
        resolve(performance.now() - pressedAt);
      });
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    Reflect.set(window, 'rivrConfirmed', confirmed);
  }, `Hands this down: ${count}`);
}

test.describe('Tablet tap to confirm', () => {
  test('@perf Log hand confirms within 100 ms on a slowed CPU', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and logs hands, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000123');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    const cdp = await tablet.context().newCDPSession(tablet);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    const times: number[] = [];
    for (let hand = 1; hand <= HANDS; hand += 1) {
      await press(tablet, ['4', '8', '000']);
      await timeNextTap(tablet, hand);
      await tablet.getByRole('button', { name: 'Log hand' }).click();
      times.push(await tablet.evaluate(() => Reflect.get(window, 'rivrConfirmed')));
    }
    test.info().annotations.push({ type: 'tap to confirm (ms)', description: times.map((ms) => ms.toFixed(1)).join(', ') });
    expect(Math.max(...times), `slowest of ${times.map((ms) => Math.round(ms)).join(', ')} ms`).toBeLessThan(BUDGET_MS);

    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await expect(tablet.getByText(`Hands this down: ${HANDS}`)).toBeVisible();
    await revoke(floor, name);
  });
});
