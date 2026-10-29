/**
 * Tonight's games on the website (#130, changed by #617). The front page shows each game's stakes and buy-in from the
 * public views, and never its tables running, open seats or waiting: the owner's parity list of 29 Oct asks for the stakes
 * only, and for Reserve to open WhatsApp.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Live floor widget', () => {
  test('Live floor widget: the games show their stakes only, and reserving a seat opens WhatsApp', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/#games`);
    const games = page.locator('#games');
    await expect(games.getByText(/^Buy-in ₹/).first()).toBeVisible();
    await expect(games.getByText(/running|waiting|open seat/)).toHaveCount(0);
    await expect(games.getByRole('link', { name: 'Reserve a seat' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
  });
});
