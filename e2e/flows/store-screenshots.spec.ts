/**
 * The app stores' screenshots (decision 0577), from seed data: a 6.9-inch iPhone for Apple and a 1080 by 1920 phone for Google.
 * Run only by hand, with the local stack, and commit what it writes:
 *   STORE_SCREENSHOTS=1 pnpm e2e --grep "Store screenshots"
 * No screen here shows bonus chips, spins or rupees.
 */
import { expect, test, type Browser } from '@playwright/test';
import { signInToPlayer } from '../support/signIn.ts';

const OUT = 'docs/brand/store/screenshots';
const SCREENS = [['card', '/card'], ['house-rules', '/profile/rules']] as const;

async function shoot(browser: Browser, device: { name: string; number: string; width: number; height: number }) {
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();
  await signInToPlayer(page, device.number);
  await page.getByRole('button', { name: 'Essential only' }).click({ timeout: 5_000 }).catch(() => undefined);
  await page.setViewportSize({ width: device.width, height: device.height });
  for (const [name, path] of SCREENS) {
    await page.goto(new URL(path, page.url()).toString());
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: `${OUT}/${device.name}-${name}.png` });
  }
  await context.close();
}

test.describe('Store screenshots', () => {
  test('shoots the store listings’ screens', async ({ browser }) => {
    test.skip(process.env.STORE_SCREENSHOTS !== '1', 'run by hand for the store listings');
    test.setTimeout(120_000);
    await shoot(browser, { name: 'iphone', number: '9000000427', width: 430, height: 932 });
    await shoot(browser, { name: 'android', number: '9000000428', width: 360, height: 640 });
  });
});
