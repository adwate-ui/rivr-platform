/**
 * Console fits (#601; decision 0282). Rhea Kapur, this flow's own floor manager, opens the console on a phone, a portrait
 * tablet and a desk. Below the desk the top bar names the screen, and its menu reaches her screens and closes on choosing
 * one or a tap outside; at the desk the rail sits beside the screen, and Go to finds a screen by name. Settings, rebuilt
 * for every size (#604), scrolls nothing sideways at any of them; every other screen joins the check as #605 rebuilds it.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };
const DESK = { width: 1440, height: 900 };

/** Nothing wider than the screen: neither the page nor the screen's own scrolling area (main), where content overflows. */
async function fitsSideways(page: Page) {
  const fits = await page.evaluate(() => {
    const main = document.querySelector('main');
    return document.documentElement.scrollWidth <= window.innerWidth && main !== null && main.scrollWidth <= main.clientWidth;
  });
  expect(fits).toBe(true);
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
