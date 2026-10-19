import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * @perf (#30; additions "Performance budgets"): a DataTable of ten thousand rows in a real browser
 * draws only the rows in view, opens quickly, and reaches its last row by scrolling. It runs with
 * the visual tests, against the built Storybook served from disk.
 */
const STATIC_DIR = new URL('../storybook-static/', import.meta.url);
const ORIGIN = 'http://storybook.rivr.test';

test.beforeEach(async ({ context }) => {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const file = fileURLToPath(new URL(`.${new URL(route.request().url()).pathname}`, STATIC_DIR));
    await (existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 }));
  });
});

test('@perf DataTable: ten thousand rows open within the budget and scroll to the last', async ({ page }) => {
  const started = Date.now();
  await page.goto(`${ORIGIN}/iframe.html?id=data-datatable--many-rows&viewMode=story`);
  const table = page.getByRole('table', { name: 'Open markers' });
  await expect(table).toHaveAttribute('aria-rowcount', '10001');
  // The budget for a console table, from the request to a drawn table; virtualised, it stays small.
  expect(Date.now() - started).toBeLessThan(3_000);
  expect(await table.getByRole('row').count()).toBeLessThan(40);

  await table.getByRole('rowgroup').last().evaluate((body) => { body.scrollTop = body.scrollHeight; });
  await expect(table.getByRole('row').last()).toHaveAttribute('aria-rowindex', '10001');
  expect(await table.getByRole('row').count()).toBeLessThan(40);
});
