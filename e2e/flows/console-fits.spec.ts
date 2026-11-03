/**
 * Console fits (#601, #605; decisions 0282, 0431, 0443). Rhea Kapur, this flow's own floor manager, opens the console on a
 * phone, the floor's 1180 px tablet and a desk: on the phone a tab bar holds Floor, Requests, Waitlist, Door and More, whose
 * menu reaches her screens and closes on choosing one; on the tablet the rail folds to its icons by itself and keeps her
 * own choice across a reload; at the desk it shows its labels, and `/` opens the search, which finds a screen by name.
 * Then the flow's own super admin, cashier and owner each open every screen their rail lists, and each tab, at 1440, 1180
 * and 390 px: nothing scrolls sideways, neither the page nor the screen's own area, and each screen shows its heading.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 1180, height: 820 };
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

/** Waits until nothing on the screen open now is still loading. */
async function settled(page: Page) {
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('status').filter({ hasText: /^Loading$/ })).toHaveCount(0);
}

/** Opens a link at a desk and waits for what it opens: the link marked current, and nothing still loading. */
async function openAtDesk(page: Page, link: Locator) {
  await page.setViewportSize(DESK);
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await settled(page);
}

/** Opens a tab at a desk by its link, or by its address when it belongs to a tab no longer shown (a part inside another). */
async function openTabAtDesk(page: Page, href: string) {
  const link = page.locator(`main nav a[href="${href}"]`);
  if ((await link.count()) > 0) return openAtDesk(page, link);
  await page.setViewportSize(DESK);
  await page.goto(`${appUrl('console')}${href}`);
  await settled(page);
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

/** Each screen the rail lists, Admin unfolded, and each of a screen's tabs past the one it opens on, measured at each size. */
async function everyScreenFits(page: Page, number: string) {
  await page.setViewportSize(DESK);
  await signInToConsole(page, number);
  const rail = page.getByRole('navigation', { name: 'Sections' });
  await expect(rail).toBeVisible();
  const admin = rail.getByRole('button', { name: 'Admin' });
  if ((await admin.count()) > 0) await admin.click();
  const screens = await hrefs(rail.getByRole('link'));
  expect(screens.length).toBeGreaterThan(0);
  for (const href of screens) {
    await openAtDesk(page, rail.locator(`a[href="${href}"]`));
    await measure(page, href);
    for (const tab of (await hrefs(page.locator('main nav a[href*="?tab="]'))).slice(1)) {
      await openTabAtDesk(page, tab);
      await measure(page, tab);
    }
  }
}

/** On a phone: More opens every screen, and choosing one opens it and closes the menu, its name in the header. */
async function openFromMore(page: Page, screen: string, group?: string) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'More' }).click();
  const more = page.getByRole('dialog', { name: 'All screens' });
  if (group !== undefined) await more.getByRole('button', { name: group }).click();
  await more.getByRole('link', { name: screen, exact: true }).click();
  await expect(more).toBeHidden();
  await expect(page.getByRole('heading', { name: screen, level: 1 })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText(screen);
}

/** On a phone: the tab bar's tabs, each a 44 px target at least, and More to every other screen. */
async function onAPhone(page: Page) {
  await page.setViewportSize(PHONE);
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
  const tabs = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Floor', 'Requests', 'Waitlist', 'Door']) {
    const tab = tabs.getByRole('link', { name, exact: true });
    await expect(tab).toBeVisible();
    expect((await tab.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await openFromMore(page, 'Members');
  await openFromMore(page, 'Settings', 'Admin');
  await fitsSideways(page);
  await tabs.getByRole('link', { name: 'Floor', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
}

/** On the floor's tablet: the rail folds to its 64 px of icons by itself; her own choice holds across a reload. */
async function onTheTablet(page: Page) {
  await page.setViewportSize(TABLET);
  const rail = page.getByRole('complementary');
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
  await expect.poll(async () => (await rail.boundingBox())?.width).toBe(64);
  await rail.getByRole('button', { name: 'Expand' }).click();
  await expect.poll(async () => (await rail.boundingBox())?.width).toBe(224);
  await page.reload();
  await expect.poll(async () => (await rail.boundingBox())?.width).toBe(224);
  await rail.getByRole('button', { name: 'Collapse' }).click();
  await expect.poll(async () => (await rail.boundingBox())?.width).toBe(64);
}

test.describe('Console fits', () => {
  test('Console fits: the console on a phone, a tablet and a desk', async ({ page }) => {
    await signInToConsole(page, '9000000644');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    await onAPhone(page);
    await onTheTablet(page);

    // At the desk, with no choice of her own, the rail shows its labels; / opens the search and Escape closes it.
    await page.evaluate(() => window.localStorage.removeItem('rivr.console.rail'));
    await page.setViewportSize(DESK);
    await page.reload();
    await expect.poll(async () => (await page.getByRole('complementary').boundingBox())?.width).toBe(224);
    await page.keyboard.press('/');
    const search = page.getByRole('dialog', { name: 'Search' });
    await expect(search).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
    await page.keyboard.press('Control+k');
    await search.getByRole('combobox', { name: 'Search' }).fill('settings');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await fitsSideways(page);
  });
});

test.describe('Console fits, every screen', () => {
  for (const { who, number } of ROLES) {
    test(`Console fits: every screen ${who} opens fits a phone, the floor's tablet and a desk`, async ({ page }) => {
      test.setTimeout(300_000);
      await everyScreenFits(page, number);
    });
  }
});
