/**
 * Finding one's way round the console v3 shell (phase 1, decision 0443) at a desk, as staff do: the rail, its Admin group
 * folded until opened, a screen's tabs, and the staff member's menu at the header's end.
 */
import { expect, type Page } from '@playwright/test';

/** Opens a screen from the rail, unfolding Admin first when the screen sits in it, and waits until it is the one open. */
export async function openFromRail(page: Page, screen: string) {
  const rail = page.getByRole('navigation', { name: 'Sections' });
  const link = rail.getByRole('link', { name: screen, exact: true });
  if ((await link.count()) === 0) await rail.getByRole('button', { name: 'Admin' }).click();
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'page');
}

/** Opens a screen from the rail, then one of its tabs; a role with that tab alone sees no tabs, and is there already. */
export async function openTab(page: Page, screen: string, tab: string) {
  await openFromRail(page, screen);
  const link = page.getByRole('main').getByRole('navigation', { name: screen, exact: true }).getByRole('link', { name: tab, exact: true });
  if ((await link.count()) > 0) {
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
}

/** Opens Settings' Devices tab at the TVs or the tablets. */
export async function openDevices(page: Page, kind: 'TVs' | 'Tablets') {
  await openTab(page, 'Settings', 'Devices');
  await page.getByRole('main').getByRole('link', { name: kind, exact: true }).click();
}

/** Opens the staff member's menu at the header's end, and gives back its panel. */
export async function openAccountMenu(page: Page) {
  await page.getByRole('banner').locator('button[aria-expanded]').click();
  return page.getByRole('group').filter({ has: page.getByRole('button', { name: 'Sign out' }) });
}

/** Switches the console to the practice venue from the staff member's menu, waits for its stripe, and closes the menu. */
export async function switchToPractice(page: Page) {
  const menu = await openAccountMenu(page);
  await menu.getByRole('switch', { name: 'Practice venue' }).click();
  await expect(page.getByRole('region', { name: 'Practice venue' })).toBeVisible();
  await page.keyboard.press('Escape');
}
