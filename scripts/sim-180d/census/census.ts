/**
 * The screen census for one app, at the project's size: every screen as every person who uses the app (src/census/
 * plan.ts), each captured with its own tabs, on the simulation's clock. A screen the person should not reach must
 * refuse or move them; census-report.ts turns the captures into flags for the review.
 */
import { test, type Page, type TestInfo } from '@playwright/test';
import { appUrl, type App } from '../../../e2e/support/apps.ts';
import type { AppName } from '../src/catalogue/types.ts';
import { planVisits, type Person, type Visit } from '../src/census/plan.ts';
import { existsSync } from 'node:fs';
import { capture, captureFile, watch, type Shot } from './capture.ts';
import { useSimClock } from './clock.ts';
import { readContext, readScreens, sessionFile } from './context.ts';
import { sql } from '../bin/stack/psql.ts';

const context = readContext();
const MAX_TABS = 10;

/** The door kiosk is the tablet app, paired as a kiosk. */
const appOf = (app: AppName): App => (app === 'door' ? 'tablet' : app);

export function sizeOf(info: TestInfo): string {
  const viewport = info.project.use.viewport;
  const browser = info.project.use.browserName === 'webkit' ? '-webkit' : '';
  return viewport ? `${String(viewport.width)}x${String(viewport.height)}${browser}` : 'unknown';
}

/** Waits for the screen to settle: the network quiet (realtime and polling allowing), then a beat for animation. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(700);
}

/** A TV shows the board its screen is set to: set it as the admin's Devices screen would, then reload. */
function tvShows(path: string): void {
  const mode = path.split('#')[1];
  if (mode === undefined || !/^[a-z_]+$/.test(mode)) return;
  sql(`update public.tv_screen set mode = '${mode}', rotation = '{}' where device_id = (select id from public.device where name = 'TV ${context.checkpoint}')`);
}

async function eachTab(page: Page, base: Shot, seen: Awaited<ReturnType<typeof watch>>): Promise<void> {
  const tabs = page.locator('main [role="tab"]:not([aria-selected="true"])');
  const names = (await tabs.allInnerTexts()).map((name) => name.trim()).filter((name) => name !== '').slice(0, MAX_TABS);
  for (const name of names) {
    await page.locator('main [role="tab"]', { hasText: name }).first().click();
    await settle(page);
    await capture(page, { ...base, path: `${base.path}#tab=${name}` }, seen, context.dir);
  }
}

async function visit(page: Page, one: Visit, info: TestInfo): Promise<void> {
  if (one.screen.app === 'display') tvShows(one.path);
  await useSimClock(page, new Date(context.simNow));
  const seen = await watch(page);
  await page.goto(`${appUrl(appOf(one.screen.app))}${one.path}`, { waitUntil: 'load' });
  await settle(page);
  const shot: Shot = { app: one.screen.app, person: one.person, path: one.path, size: sizeOf(info), checkpoint: context.checkpoint, expect: one.expect };
  const record = await capture(page, shot, seen, context.dir);
  if (record.outcome === 'open') await eachTab(page, shot, seen);
}

/** A visitor who has answered the cookie banner (decision 0298), as the e2e flows start; states.census.ts sees it unanswered. */
export function answeredBanner() {
  const answer = { name: 'rivr.cookies', value: JSON.stringify({ maps: false, analytics: false }) };
  const apps: readonly App[] = ['player', 'web'];
  return { cookies: [], origins: apps.map((each) => ({ origin: appUrl(each), localStorage: [answer] })) };
}

/** The website's /$slug once per published page; every other screen as the catalogue lists it. */
function screensOf(app: AppName): ReturnType<typeof readScreens> {
  return readScreens().flatMap((screen) =>
    app === 'web' && screen.app === 'web' && screen.path === '/$slug' ? context.slugs.map((slug) => ({ ...screen, path: `/${slug}` })) : [screen]);
}

export function defineCensus(app: AppName): void {
  const { visits } = planVisits(screensOf(app), app, context.params);
  const people = [...new Set(visits.map((one) => one.person))];
  for (const person of people) {
    test.describe(`${app} as ${person}`, () => {
      // One TV: its board is set per test, so the TV's tests take turns.
      if (app === 'display') test.describe.configure({ mode: 'serial' });
      test.use({ storageState: person === 'visitor' ? answeredBanner() : sessionFile(context, person satisfies Person) });
      for (const one of visits.filter((each) => each.person === person)) {
        test(`${one.path} (${one.expect})`, async ({ page }, info) => {
          // A census stopped part-way carries on: a screen captured already for this person and size is not opened again.
          const done = existsSync(`${captureFile({ app, size: sizeOf(info), person, path: one.path }, context.dir)}.json`);
          test.skip(done, 'captured already');
          await visit(page, one, info);
        });
      }
    });
  }
}
