/**
 * PWA (#16): the player app installs from its manifest, with the brand kit's icons and the tokens'
 * colours, gives every iPhone screen its launch image, and opens offline from the shell its service
 * worker keeps. The install offer itself is unit-tested: headless browsers never offer to install.
 */
import manifestColors from '@rivr/tokens/manifest-colors.json' with { type: 'json' };
import { expect, test, type APIRequestContext } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

/** Width and height of a PNG, from the IHDR chunk after its signature. */
async function pngSize(request: APIRequestContext, path: string) {
  const response = await request.get(`${appUrl('player')}${path}`);
  expect(response.status(), path).toBe(200);
  const png = await response.body();
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test.describe('PWA', () => {
  test('the player app installs from its manifest, with the brand kit\'s icons and the tokens\' colours', async ({ request }) => {
    const manifest: unknown = await (await request.get(`${appUrl('player')}/manifest.webmanifest`)).json();
    expect(manifest).toMatchObject({ name: 'RIVR Poker Club', short_name: 'RIVR', display: 'standalone', start_url: '/', ...manifestColors });
    const icons: unknown = typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, 'icons') : [];
    expect(icons).toContainEqual(expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }));
    for (const icon of Array.isArray(icons) ? icons : []) {
      const src = String(Reflect.get(icon, 'src'));
      const { width, height } = await pngSize(request, src);
      expect(`${String(width)}x${String(height)}`, src).toBe(Reflect.get(icon, 'sizes'));
    }
  });

  test('every iPhone launch screen is linked for the screen it fits', async ({ request }) => {
    const html = await (await request.get(appUrl('player'))).text();
    const links = [...html.matchAll(/device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)" href="([^"]+)"/g)];
    expect(links.length).toBeGreaterThanOrEqual(13);
    for (const [, points, tall, ratio, href] of links) {
      // The image is the screen in pixels: its points times the pixel ratio.
      expect(await pngSize(request, href ?? ''), href).toEqual({ width: Number(points) * Number(ratio), height: Number(tall) * Number(ratio) });
    }
    expect(html).toContain(`<meta name="theme-color" content="${manifestColors.theme_color}">`);
  });

  test('the app opens offline from the shell its service worker keeps', async ({ page, context }) => {
    await page.setViewportSize(VIEWPORT.player);
    await page.goto(`${appUrl('player')}/sign-in`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Reloaded once the worker controls the page, then with no connection at all.
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Skill runs deep.')).toBeVisible();
    await context.setOffline(false);
  });
});
