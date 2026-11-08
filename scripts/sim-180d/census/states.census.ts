/**
 * The states each screen must handle (design 3b), once per screen as the first person who opens it: every request
 * failing, the device offline (player, tablet and door), Back after each of its links (the 8 Nov House rules loop),
 * and a first visit with nothing stored (the cookie banner, a deep link signed out).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { appUrl, VIEWPORT, type App } from '../../../e2e/support/apps.ts';
import type { AppName } from '../src/catalogue/types.ts';
import { planVisits, type Visit } from '../src/census/plan.ts';
import { capture, watch } from './capture.ts';
import { answeredBanner, settle } from './census.ts';
import { useSimClock } from './clock.ts';
import { readContext, readScreens, sessionFile } from './context.ts';
import { CONTENT_LINKS, linksSchema } from './inpage.ts';

const context = readContext();
const APPS: readonly AppName[] = ['player', 'console', 'tablet', 'door', 'display', 'web'];
const OFFLINE_APPS: readonly AppName[] = ['player', 'tablet', 'door'];
const appOf = (app: AppName): App => (app === 'door' ? 'tablet' : app);

function firstOpeners(): Visit[] {
  return APPS.flatMap((app) => {
    const seen = new Set<string>();
    return planVisits(readScreens(), app, context.params).visits.filter((one) => {
      if (one.expect !== 'open' || seen.has(one.path)) return false;
      if (one.person.startsWith('member') && context.numbers[one.person] === undefined) return false;
      seen.add(one.path);
      return true;
    });
  });
}

async function open(page: Page, one: Visit): Promise<Awaited<ReturnType<typeof watch>>> {
  await useSimClock(page, new Date(context.simNow));
  const seen = await watch(page);
  await page.goto(`${appUrl(appOf(one.screen.app))}${one.path}`, { waitUntil: 'load' });
  await settle(page);
  return seen;
}

const shotOf = (one: Visit, state: string) => ({
  app: one.screen.app, person: one.person, path: `${one.path}#${state}`, size: 'states', checkpoint: context.checkpoint, expect: one.expect,
});

/** Follows each link on the screen and presses Back: the screen's own address must come back. */
async function backLoops(page: Page, one: Visit): Promise<{ link: string; after: string }[]> {
  const home = page.url();
  const links = linksSchema.parse(await page.evaluate(CONTENT_LINKS));
  const loops: { link: string; after: string }[] = [];
  for (const link of links) {
    await page.goto(home, { waitUntil: 'load' });
    await settle(page);
    const anchor = page.locator(`main a[href="${new URL(link).pathname}${new URL(link).search}"]`).first();
    if ((await anchor.count()) === 0) continue;
    await anchor.click();
    await page.waitForURL((url) => url.href !== home, { timeout: 5_000 }).catch(() => undefined);
    await page.goBack();
    await settle(page);
    if (page.url() !== home) loops.push({ link, after: page.url() });
  }
  const folder = join(context.dir, one.screen.app, 'states', one.person);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${one.path.replaceAll(/[^a-zA-Z0-9]+/g, '_') || 'home'}.back.json`), `${JSON.stringify({ path: one.path, links, loops }, null, 2)}\n`);
  return loops;
}

for (const one of firstOpeners()) {
  test.describe(`${one.screen.app} ${one.path} as ${one.person}`, () => {
    test.use({
      storageState: one.person === 'visitor' ? answeredBanner() : sessionFile(context, one.person),
      viewport: VIEWPORT[appOf(one.screen.app)],
    });

    test('every request failing', async ({ page }) => {
      await page.route('**/rest/v1/**', (route) => route.abort());
      const seen = await open(page, one);
      await capture(page, shotOf(one, 'error'), seen, context.dir);
    });

    if (OFFLINE_APPS.includes(one.screen.app)) {
      test('offline', async ({ page }) => {
        const seen = await open(page, one);
        await page.context().setOffline(true);
        await page.reload().catch(() => undefined);
        await settle(page);
        await capture(page, shotOf(one, 'offline'), seen, context.dir);
      });
    }

    test('Back after each link', async ({ page }) => {
      await open(page, one);
      await backLoops(page, one);
    });
  });
}

test.describe('a first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const [app, path] of [['web', '/'], ['player', '/sign-in'], ['player', '/rewards'], ['console', '/members']] as const) {
    test(`${app} ${path} with nothing stored`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT[app]);
      const one: Visit = { person: 'visitor', path, expect: 'open', screen: { app, path, kind: 'menu', anyOf: [], source: 'states' } };
      const seen = await open(page, one);
      await capture(page, shotOf(one, 'first-visit'), seen, context.dir);
    });
  }
});
