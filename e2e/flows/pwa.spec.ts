/**
 * PWA (#16): the player app installs from its manifest, with the brand kit's icons and the tokens'
 * colours, gives every iPhone screen its launch image, and opens offline from the shell its service
 * worker keeps. The install offer itself is unit-tested: headless browsers never offer to install.
 */
import manifestColors from '@rivr/tokens/manifest-colors.json' with { type: 'json' };
import { expect, test, type APIRequestContext } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

/** Width and height of a PNG, from the IHDR chunk after its signature. */
async function pngSize(request: APIRequestContext, path: string) {
  const response = await request.get(`${appUrl('player')}${path}`);
  expect(response.status(), path).toBe(200);
  const png = await response.body();
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

test.describe('PWA', { tag: '@staging' }, () => {
  test('the player app installs from its manifest, with the brand kit\'s icons and the tokens\' colours', async ({ request }) => {
    const manifest: unknown = await (await request.get(`${appUrl('player')}/manifest.webmanifest`)).json();
    expect(manifest).toMatchObject({ name: 'RIVR Poker Club', short_name: 'RIVR', display: 'standalone', start_url: '/', ...manifestColors });
    // Any way up: a member's phone may be mounted on its side (WCAG 1.3.4, F-058).
    expect(manifest).not.toHaveProperty('orientation');
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
    // The club's green under the iPhone's clock, its content kept clear by the safe-area insets (F-167).
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('content="black-translucent"');
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
    // Nobody signed in with no connection: it says so, and no code can be asked for.
    await expect(page.getByText('No connection. Send the code once you are back online.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send code' })).toBeDisabled();
    await context.setOffline(false);
  });
});

// Signs in, so not on staging's @staging run. Tara (seeded verified) signs in in no other flow, as Auth sends one code a minute.
test.describe('PWA, a member offline', () => {
  test('a member who has used the app opens Home and the card with no connection, and never an endless Identity', async ({ page, context }) => {
    await signInToPlayer(page, '9000000621');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // What the app opens with is kept a moment after it is read: the card too, once it has been seen, and on later launches.
    const isKept = (name: string) => page.evaluate((key) => localStorage.getItem('rivr.offline.v1')?.includes(key) ?? false, name);
    await page.goto(`${appUrl('player')}/card`);
    await expect(page.getByRole('img', { name: 'Your door code' })).toBeVisible();
    await expect.poll(() => isKept('membership-card')).toBe(true);
    await page.goto(appUrl('player'));
    await expect(page.getByRole('heading', { name: 'Home', level: 1 })).toBeAttached();
    await expect.poll(() => isKept('floor-tables')).toBe(true);
    expect(await isKept('membership-card')).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText(/^No connection\. Showing tables as of \d\d:\d\d\.$/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Identity' })).toHaveCount(0);
    await page.goto(`${appUrl('player')}/card`);
    await expect(page.getByRole('heading', { name: 'No connection' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Your number', { exact: true })).toBeVisible();
    await expect(page.getByText('Give your number at the door.')).toBeVisible();
    await context.setOffline(false);
  });
});
