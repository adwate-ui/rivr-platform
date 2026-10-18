/**
 * Website (#9): the club's published pages, rendered on demand from the public views; every link into
 * the player app, and across the website, carries the codes of the link the visitor arrived by (#10,
 * decision 0031); a draft and the practice venue's page are never shown.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Website', () => {
  test('the website shows the club\'s pages, and its links into the player app carry the visitor\'s codes', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/?ref=FRIEND1&utm_source=instagram`);
    await expect(page.getByRole('heading', { level: 1, name: 'RIVR Poker Club' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', `${appUrl('player')}/sign-in?ref=FRIEND1&utm_source=instagram`);

    await page.getByRole('link', { name: 'RIVR Academy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RIVR Academy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book a seat' })).toHaveAttribute('href', `${appUrl('player')}/academy?ref=FRIEND1&utm_source=instagram`);
  });

  test('a draft page is not there, and nor is the front page by another address', async ({ request }) => {
    expect((await request.get(`${appUrl('web')}/careers`)).status()).toBe(404);
    expect((await request.get(`${appUrl('web')}/home`)).status()).toBe(404);
  });
});
