import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokens } from '@rivr/tokens';
import { expect, test } from '@playwright/test';

/**
 * @perf (#30; additions "Performance budgets"): a DataTable of ten thousand rows in a real browser
 * draws only the rows in view, opens quickly, and reaches its last row by scrolling, as lines at a
 * desk and as cards on a phone (#603). It runs with the visual tests, against the built Storybook
 * served from disk.
 */
const STATIC_DIR = new URL('../storybook-static/', import.meta.url);
const ORIGIN = 'http://storybook.rivr.test';

test.beforeEach(async ({ context }) => {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const file = fileURLToPath(new URL(`.${new URL(route.request().url()).pathname}`, STATIC_DIR));
    await (existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 }));
  });
});

const SIZES = [
  { story: 'data-datatable--many-rows', where: 'at a desk', viewport: undefined },
  { story: 'data-datatable--many-rows-on-a-phone', where: 'as cards on a phone', viewport: tokens.viewport.phone },
];

for (const { story, where, viewport } of SIZES) test(`@perf DataTable: ten thousand rows ${where} open within the budget and scroll to the last`, async ({ page }) => {
  if (viewport !== undefined) await page.setViewportSize(viewport);
  const started = Date.now();
  await page.goto(`${ORIGIN}/iframe.html?id=${story}&viewMode=story`);
  const table = page.getByRole('table', { name: 'Open markers' });
  await expect(table).toHaveAttribute('aria-rowcount', '10001');
  // The budget for a console table, from the request to a drawn table; virtualised, it stays small.
  expect(Date.now() - started).toBeLessThan(3_000);
  expect(await table.getByRole('row').count()).toBeLessThan(40);
  // Each drawn row has the height its lines need, so none is cut off.
  expect(await table.getByRole('row').nth(1).evaluate((row) => row.scrollHeight <= row.clientHeight)).toBe(true);

  await table.getByRole('rowgroup').last().evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(table.getByRole('row').last()).toHaveAttribute('aria-rowindex', '10001');
  expect(await table.getByRole('row').count()).toBeLessThan(40);
});
