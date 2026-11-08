/**
 * The sheets and records the census cannot reach by address: they open from a list or a seat. Each is captured as a
 * screen is (census/capture.ts): a member's record and its parts, a seated player's sheet, Seat a player, seating from
 * a list, and on the phone the join sheet, Top up and Add time. Opened the way the e2e flows open them.
 */
import { test, type Page } from '@playwright/test';
import { appUrl, VIEWPORT } from '../../../e2e/support/apps.ts';
import { showSeats } from '../../../e2e/support/floor.ts';
import type { Person } from '../src/census/plan.ts';
import { capture, watch, type Shot } from './capture.ts';
import { settle } from './census.ts';
import { useSimClock } from './clock.ts';
import { readContext, sessionFile } from './context.ts';

const context = readContext();

async function open(page: Page, app: 'console' | 'player', path: string): Promise<Awaited<ReturnType<typeof watch>>> {
  await useSimClock(page, new Date(context.simNow));
  const seen = await watch(page);
  await page.goto(`${appUrl(app)}${path}`, { waitUntil: 'load' });
  await settle(page);
  return seen;
}

const shotOf = (app: 'console' | 'player', person: Person, path: string, size: string): Shot =>
  ({ app, person, path, size, checkpoint: context.checkpoint, expect: 'open' });

test.describe('console sheets', () => {
  test.use({ viewport: VIEWPORT.console });

  test('a member record and its parts, as a super admin', async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: sessionFile(context, 'super_admin'), timezoneId: 'Asia/Kolkata' })).newPage();
    const seen = await open(page, 'console', '/members');
    await page.getByRole('table', { name: 'Members' }).getByRole('row').nth(1).getByRole('button').first().click();
    await settle(page);
    await capture(page, shotOf('console', 'super_admin', '/members#record', 'sheets'), seen, context.dir);
    for (const part of ['Tier and break', 'Account']) {
      const link = page.getByRole('link', { name: part, exact: true });
      if ((await link.count()) === 0) continue;
      await link.first().click();
      await settle(page);
      await capture(page, shotOf('console', 'super_admin', `/members#record-${part}`, 'sheets'), seen, context.dir);
    }
  });

  test('a seated player, Seat a player, and seating from a list, as the floor', async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: sessionFile(context, 'floor'), timezoneId: 'Asia/Kolkata' })).newPage();
    const seen = await open(page, 'console', '/');
    await showSeats(page);
    await page.getByRole('button', { name: /^Seat \d+, (?!Open)/ }).first().click();
    await settle(page);
    await capture(page, shotOf('console', 'floor', '/#player-sheet', 'sheets'), seen, context.dir);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Seat \d+, Open$/ }).first().click();
    await settle(page);
    await capture(page, shotOf('console', 'floor', '/#seat-a-player', 'sheets'), seen, context.dir);
    await page.keyboard.press('Escape');
    await page.goto(`${appUrl('console')}/waitlist`);
    await settle(page);
    const seat = page.getByRole('button', { name: /^Seat (?!a player)/ });
    if ((await seat.count()) > 0) {
      await seat.first().click();
      await settle(page);
      await capture(page, shotOf('console', 'floor', '/waitlist#seat-from-list', 'sheets'), seen, context.dir);
    }
  });
});

test.describe('player sheets', () => {
  test.use({ viewport: VIEWPORT.player });

  test('the join sheet, as a member browsing the tables', async ({ browser }) => {
    test.skip(context.numbers['member_browsing'] === undefined, 'no member browsing at this checkpoint');
    const page = await (await browser.newContext({ storageState: sessionFile(context, 'member_browsing'), timezoneId: 'Asia/Kolkata' })).newPage();
    const seen = await open(page, 'player', '/');
    await page.getByRole('button', { name: / · / }).first().click();
    await settle(page);
    await capture(page, shotOf('player', 'member_browsing', '/#join-sheet', 'sheets'), seen, context.dir);
  });

  test('Top up and Add time, as a seated member', async ({ browser }) => {
    test.skip(context.numbers['member_seated'] === undefined, 'no member seated at this checkpoint');
    const page = await (await browser.newContext({ storageState: sessionFile(context, 'member_seated'), timezoneId: 'Asia/Kolkata' })).newPage();
    const seen = await open(page, 'player', '/');
    for (const action of ['Top up', 'Add time']) {
      const button = page.getByRole('button', { name: action, exact: true });
      if ((await button.count()) === 0) continue;
      await button.first().click();
      await settle(page);
      await capture(page, shotOf('player', 'member_seated', `/#${action.replace(' ', '-').toLowerCase()}`, 'sheets'), seen, context.dir);
      await page.keyboard.press('Escape');
    }
  });
});
