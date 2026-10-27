/**
 * Live floor widget (#130; tech plan item 14). The website's front page shows tonight's games, each with its tables
 * running, its open seats and how many wait, from the public views, which hold counts and no one's name. The page reads
 * itself again every half minute and swaps in the games band, so the numbers stay live without a reload.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Live floor widget', () => {
  test('Live floor widget: tables running, open seats and waiting, read again every half minute', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(appUrl('web'));
    const line = page.getByText(/^\d+ tables? running · \d+ open seats? · \d+ waiting$/).first();
    await expect(line).toBeVisible();
    // The page reads itself again and swaps the band in place.
    const reread = page.waitForResponse((response) => response.url() === page.url() && response.request().resourceType() === 'fetch',
      { timeout: 40_000 });
    expect((await reread).ok()).toBe(true);
    await expect(page.getByText(/^\d+ tables? running · \d+ open seats? · \d+ waiting$/).first()).toBeVisible();
  });
});
