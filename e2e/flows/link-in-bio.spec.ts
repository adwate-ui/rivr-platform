/**
 * Link-in-bio (#39): the one link on every social profile. On a phone it leads with joining the
 * waitlist, handed off to the player app with the visitor's codes, then the Academy and sign-up,
 * tonight's games with how many wait, and how to find the club.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Link-in-bio', () => {
  test('a visitor from a social profile joins the waitlist, books the Academy or finds the club', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.player);
    await page.goto(`${appUrl('web')}/links?utm_source=instagram`);
    await expect(page.getByRole('heading', { level: 1, name: 'RIVR Poker Club' })).toBeVisible();
    const player = appUrl('player');
    await expect(page.getByRole('link', { name: 'Join the waitlist' })).toHaveAttribute('href', `${player}/?utm_source=instagram`);
    await expect(page.getByRole('link', { name: 'Book RIVR Academy' })).toHaveAttribute('href', `${player}/academy?utm_source=instagram`);
    await expect(page.getByRole('link', { name: 'Join RIVR' })).toHaveAttribute('href', `${player}/sign-in?utm_source=instagram`);

    await expect(page.getByRole('heading', { level: 2, name: 'Tonight\'s games' })).toBeVisible();
    await expect(page.getByText('NLH 100/200', { exact: true })).toBeVisible();
    // The seed keeps three waiting for 100/200; the website reads the count from public_waitlist_length.
    await expect(page.getByText(/^\d+ tables? running · \d+ open seats? · \d+ waiting$/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get directions' })).toBeVisible();
    // The site's links wrap under the wordmark: nothing is wider than the phone.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEWPORT.player.width);
  });
});
