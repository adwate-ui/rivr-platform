/**
 * Smoke: every surface starts on its target screen size against the seeded stack. The linked flows
 * (design prompt section 7, additions "Linked flows") are added by the lanes, one file each.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT, type App } from '../support/apps.ts';

async function open(page: import('@playwright/test').Page, app: App) {
  await page.setViewportSize(VIEWPORT[app]);
  await page.goto(appUrl(app));
}

test.describe('smoke: every surface starts', () => {
  test('the player app opens on sign-in for someone signed out', async ({ page }) => {
    await open(page, 'player');
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
  });

  test('the console opens on sign-in for someone signed out', async ({ page }) => {
    await open(page, 'console');
    await expect(page.getByRole('textbox', { name: 'Mobile number' })).toBeVisible();
  });

  test('a dealer tablet that is not paired asks for its pairing code', async ({ page }) => {
    await open(page, 'tablet');
    await expect(page.getByRole('heading', { name: 'Tablet pairing' })).toBeVisible();
  });

  test('a TV that is not paired asks to be paired', async ({ page }) => {
    await open(page, 'display');
    await expect(page.getByRole('heading', { name: 'Screen pairing' })).toBeVisible();
  });

  test('the driver app opens on pickups', async ({ page }) => {
    await open(page, 'driver');
    await expect(page.getByRole('heading', { name: 'Pickups' })).toBeVisible();
  });

  test('the website names the club', async ({ page }) => {
    await open(page, 'web');
    await expect(page.getByRole('heading', { name: 'RIVR Poker Club' })).toBeVisible();
  });
});
