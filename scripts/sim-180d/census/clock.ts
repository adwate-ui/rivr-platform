import type { Page, Route } from '@playwright/test';

/** A session as Auth returns it from /token and /verify: `expires_at` in seconds since 1970. */
function isSession(value: unknown): value is { expires_in: number; expires_at: number } {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'expires_in') === 'number' && typeof Reflect.get(value, 'expires_at') === 'number';
}

async function onBrowserClock(page: Page, route: Route): Promise<void> {
  const response = await route.fetch();
  const body: unknown = await response.json().catch(() => null);
  if (!isSession(body)) {
    await route.fulfill({ response });
    return;
  }
  const browserNow = await page.evaluate(() => Date.now());
  await route.fulfill({ response, json: { ...body, expires_at: Math.floor(browserNow / 1000) + body.expires_in } });
}

/**
 * Puts the browser on the simulation's clock, so "tonight", countdowns and "2 min ago" agree with the database.
 * Auth issues tokens on real time, which would look long expired to a browser months ahead, so each session's
 * `expires_at` is moved onto the browser's clock. The token itself is untouched: the API checks it on real time.
 */
export async function useSimClock(page: Page, simNow: Date): Promise<void> {
  await page.clock.install({ time: simNow });
  await page.route(/\/auth\/v1\/(token|verify)/, (route) => onBrowserClock(page, route));
}
