/**
 * Console fits (#601, #605; decision 0282). Rhea Kapur, this flow's own floor manager, opens the console on a phone, a
 * portrait tablet and a desk: below the desk the top bar names the screen, and its menu reaches her screens and closes on
 * choosing one or a tap outside; at the desk the rail sits beside the screen, and Go to finds a screen by name. Then the
 * flow's own super admin, cashier and owner each open every screen their rail lists, at 390, 768 and 1440 px: nothing
 * scrolls sideways, neither the page nor the screen's own area, and each screen shows its heading.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };
const DESK = { width: 1440, height: 900 };

const ROLES = [
  { who: 'a super admin', number: '9000000645' },
  { who: 'a cashier', number: '9000000646' },
  { who: 'an owner', number: '9000000647' },
];

/** How far the page, or the screen's own scrolling area (main), reaches past the window: 0 when it fits. */
function overflow(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    const mainOver = main === null ? 0 : main.scrollWidth - main.clientWidth;
    return Math.max(0, document.documentElement.scrollWidth - window.innerWidth, mainOver);
  });
}

/** Nothing wider than the screen: neither the page nor the screen's own scrolling area. */
async function fitsSideways(page: Page) {
  expect(await overflow(page)).toBe(0);
}

/** Each link's address, in order. */
const hrefs = (links: Locator) => links.evaluateAll((all) => all.map((link) => link.getAttribute('href') ?? ''));

/** Opens a link at a desk and waits for what it opens: the link marked current, and nothing still loading. */
async function openAtDesk(page: Page, link: Locator) {
  await page.setViewportSize(DESK);
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /^Loading$/ })).toHaveCount(0);
}

/** The screen open now, at each size: nothing sideways, and its heading in view. */
async function measure(page: Page, what: string) {
  const heading = page.getByRole('main').getByRole('heading', { level: 1 }).first();
  for (const size of [DESK, TABLET, PHONE]) {
    await page.setViewportSize(size);
    await expect.poll(() => overflow(page), { message: `${what} at ${size.width} px` }).toBe(0);
    await expect(heading).toBeVisible();
  }
}

/** Each screen the rail lists, and each of a screen's tabs past the one it opens on, measured at each size. */
async function everyScreenFits(page: Page, number: string) {
  await page.setViewportSize(DESK);
  await signInToConsole(page, number);
  const rail = page.getByRole('navigation', { name: 'Sections' });
  await expect(rail).toBeVisible();
  const screens = await hrefs(rail.getByRole('link'));
  expect(screens.length).toBeGreaterThan(0);
  for (const href of screens) {
    await openAtDesk(page, rail.locator(`a[href="${href}"]`));
    await measure(page, href);
    for (const tab of (await hrefs(page.locator('main nav a[href*="?tab="]'))).slice(1)) {
      await openAtDesk(page, page.locator(`main nav a[href="${tab}"]`));
      await measure(page, tab);
    }
  }
}

/** Below the desk: the menu opens the rail, and choosing a screen opens it and closes the menu. */
async function openFromMenu(page: Page, screen: string) {
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Sections' });
  await menu.getByRole('link', { name: screen, exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole('heading', { name: screen, level: 1 })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText(screen);
}

test.describe('Console fits', () => {
  test('Console fits: the console on a phone, a tablet and a desk', async ({ page }) => {
    await signInToConsole(page, '9000000644');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();

    for (const size of [PHONE, TABLET]) {
      await page.setViewportSize(size);
      await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
      // A tap outside the menu closes it.
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('dialog', { name: 'Sections' })).toBeVisible();
      await page.mouse.click(size.width - 20, size.height / 2);
      await expect(page.getByRole('dialog', { name: 'Sections' })).toBeHidden();
      await openFromMenu(page, 'Members');
      await openFromMenu(page, 'Settings');
      await fitsSideways(page);
      await openFromMenu(page, 'Live floor');
    }

    await page.setViewportSize(DESK);
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    await page.getByRole('searchbox', { name: 'Go to' }).fill('settings');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await fitsSideways(page);
  });
});

test.describe('Console fits, every screen', () => {
  for (const { who, number } of ROLES) {
    test(`Console fits: every screen ${who} opens fits a phone, a portrait tablet and a desk`, async ({ page }) => {
      test.setTimeout(300_000);
      await everyScreenFits(page, number);
    });
  }
});
