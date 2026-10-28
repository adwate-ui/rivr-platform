/**
 * One-click publishing (#154; decision 0269). Arjun Kohli, this flow's own marketing manager, publishes an image and
 * its caption to every channel; none is connected, so each offers the image and caption to download and post. The
 * refusals and the kill switch are proved in supabase/tests/186_social_publishing.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

// A one-pixel PNG.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('Publishing', () => {
  test('marketing publishes a post to every channel and downloads it for each to post', async ({ page }) => {
    test.skip(isRemoteTarget(), 'uploads to the venue\u2019s bucket, so the local stack only');
    const caption = `RIVR Sunday ${String(Date.now()).slice(-6)}: ₹5,00,000 guaranteed`;
    await signInToConsole(page, '9000000636');
    await page.getByRole('link', { name: 'Social' }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'sunday.png', mimeType: 'image/png', buffer: PIXEL });
    await page.getByRole('textbox', { name: 'Caption' }).fill(caption);
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published. Download the image and caption below for each channel to post.')).toBeVisible();
    const row = page.getByRole('table', { name: 'Posts' }).getByRole('row').filter({ hasText: caption });
    await expect(row).toContainText('Instagram: download and post');
    await expect(row).toContainText('WhatsApp: download and post');
    await expect(row.getByRole('link', { name: 'Image' })).toHaveAttribute('href', /\/social-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
    await expect(row.getByRole('link', { name: 'Caption' })).toHaveAttribute('href', /^data:text\/plain/);
  });
});
