/**
 * Website (#9): the club's published pages, rendered on demand from the public views; every link into
 * the player app, and across the website, carries the codes of the link the visitor arrived by (#10,
 * decision 0031); a draft and the practice venue's page are never shown.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Website', { tag: '@staging' }, () => {
  test('the website shows the club\'s pages, and its links into the player app carry the visitor\'s codes', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/?ref=FRIEND1&utm_source=instagram`);
    await expect(page.getByRole('heading', { level: 1, name: 'Bring your poker face.' })).toBeVisible();
    // A shared link previews with the brand image, and points at the page without the visitor's codes (F3-30).
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${appUrl('web')}/`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${appUrl('web')}/og-image.png`);
    expect((await page.request.get(`${appUrl('web')}/og-image.png`)).status()).toBe(200);
    expect((await page.request.get(`${appUrl('web')}/icons/favicon-32.png`)).status()).toBe(200);
    await expect(page.getByRole('link', { name: 'Join RIVR' }).first()).toHaveAttribute('href', `${appUrl('player')}/sign-in?ref=FRIEND1&utm_source=instagram`);
    await expect(page.getByRole('link', { name: 'Member app' }).first()).toHaveAttribute('href', `${appUrl('player')}/?ref=FRIEND1&utm_source=instagram`);
    // Reserving a seat is a WhatsApp message to the club (#616).
    await expect(page.getByRole('banner').getByRole('link', { name: 'Reserve a seat' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);

    const menu = page.getByRole('navigation', { name: 'Site' });
    await expect(menu.getByRole('link', { name: 'RIVR Academy' })).toHaveCount(0);
    await menu.getByRole('link', { name: 'Membership' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RIVR membership' })).toBeVisible();

    // The Academy is off at launch (decision 0308): out of the menu, and its page is not there.
    expect((await page.request.get(`${appUrl('web')}/academy`)).status()).toBe(404);
  });

  test('the cookie banner asks once, and the map loads only once maps are allowed (#616)', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/visit`);
    const banner = page.getByRole('region', { name: 'Cookies on this website' });
    const map = page.locator('iframe[data-consent-src]');
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Essential only' }).click();
    await expect(banner).toBeHidden();
    await expect(map).not.toHaveAttribute('src');

    await page.reload();
    await expect(banner).toBeHidden();
    await page.getByRole('button', { name: 'Allow maps' }).click();
    await expect(map).toHaveAttribute('src', /^https:\/\/www\.google\.com\/maps\?q=/);

    // The footer opens the choices again, as they now stand, shown open rather than behind Choose.
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(banner.getByRole('checkbox', { name: /Maps/ })).toBeVisible();
    await expect(banner.getByRole('checkbox', { name: /Maps/ })).toBeChecked();
  });

  test('the front page in its bands: the room, the club, the app, the tables and the way in', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(appUrl('web'));
    await expect(page.getByText('RIVR Poker Club · Gurugram')).toBeVisible();
    // The teaser's room, labelled as the teaser labels it.
    await expect(page.locator('video[data-web-video]')).toHaveAttribute('poster', '/media/hero-room.webp');
    await expect(page.getByText('Concept visualisation').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Built for the long session.' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'A dealer in a waistcoat deals at a table' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Done waiting for a seat?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', `${appUrl('player')}/`);
    await expect(page.getByRole('heading', { level: 2, name: 'Hold your nerve.' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Find us' })).toBeVisible();
    await expect(page.getByText('Strictly 18+. Poker is a game of skill.')).toBeVisible();

    // On a phone the page fits the screen: nothing scrolls sideways.
    await page.setViewportSize(VIEWPORT.player);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT.player.width);

    // A visitor who asks for less motion sees the room's still, not the loop.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('video[data-web-video]')).toBeHidden();
    await expect(page.locator('img[src="/media/hero-room.webp"]')).toBeVisible();
  });

  test('a draft page is not there, and nor is the front page by another address', async ({ request }) => {
    expect((await request.get(`${appUrl('web')}/careers`)).status()).toBe(404);
    expect((await request.get(`${appUrl('web')}/home`)).status()).toBe(404);
  });

  test('a missing page keeps the visitor\'s codes on the way home', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    for (const address of ['/careers', '/academy/no-such-page']) {
      const response = await page.goto(`${appUrl('web')}${address}?ref=FRIEND1`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'RIVR Poker Club' })).toHaveAttribute('href', '/?ref=FRIEND1');
      await expect(page.getByRole('link', { name: 'Front page' })).toHaveAttribute('href', '/?ref=FRIEND1');
    }
  });
});
