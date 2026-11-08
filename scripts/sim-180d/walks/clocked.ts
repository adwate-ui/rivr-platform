/**
 * `@playwright/test` for the walks, on the simulation's clock. The e2e flows import that name; the walks' tsconfig maps
 * it here (`playwright test --tsconfig walks/tsconfig.json`), so every flow runs unchanged on a checkpoint night. Each
 * browser context a flow makes, through the page fixture or browser.newContext / newPage, starts at the checkpoint's
 * time, with Auth's session expiry moved onto that clock (census/clock.ts explains why).
 */
import { test as base, type Browser, type BrowserContext, type Route } from 'playwright/test';

export * from 'playwright/test';

const SIM_NOW = new Date(process.env['WALK_SIM_NOW'] ?? 'invalid');

function isSession(value: unknown): value is { expires_in: number; expires_at: number } {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'expires_in') === 'number' && typeof Reflect.get(value, 'expires_at') === 'number';
}

async function onSimClock(context: BrowserContext): Promise<BrowserContext> {
  if (Number.isNaN(SIM_NOW.getTime())) throw new Error('WALK_SIM_NOW is not set: run the walks through `pnpm walks`');
  const installedAt = Date.now();
  await context.clock.install({ time: SIM_NOW });
  await context.route(/\/auth\/v1\/(token|verify)/, async (route: Route) => {
    const response = await route.fetch();
    const body: unknown = await response.json().catch(() => null);
    if (!isSession(body)) {
      await route.fulfill({ response });
      return;
    }
    // The fake clock runs on from SIM_NOW in real time.
    const browserNow = SIM_NOW.getTime() + (Date.now() - installedAt);
    await route.fulfill({ response, json: { ...body, expires_at: Math.floor(browserNow / 1000) + body.expires_in } });
  });
  return context;
}

type ContextOptions = Parameters<Browser['newContext']>[0];

function clocked(browser: Browser): Browser {
  return new Proxy(browser, {
    get(target, property, receiver) {
      if (property === 'newContext') return async (options?: ContextOptions) => onSimClock(await target.newContext(options));
      if (property === 'newPage') {
        return async (options?: ContextOptions) => {
          const context = await onSimClock(await target.newContext(options));
          const page = await context.newPage();
          // browser.newPage's page owns its context: closing one closes the other.
          page.on('close', () => void context.close());
          return page;
        };
      }
      const value: unknown = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await use(await onSimClock(context));
  },
  browser: [
    async ({ browser }, use) => {
      await use(clocked(browser));
    },
    { scope: 'worker' },
  ],
});
