/**
 * Glaza's statement (#109; decision 0265). Neha Gill, this flow's own finance manager, imports Glaza's CSV for the club
 * month just ended: four club sandwiches comped at ₹180 and four beers sold at ₹400 that cost ₹150. The statement owes
 * Glaza ₹720 of comps, less RIVR's half of the ₹1,000 margin: ₹220. Matching lines to visits, refusals and the latest
 * import standing in are proved in supabase/tests/182_glaza.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** The club month just ended, as its 1st (`2026-09-01`) and as the console names it (`September 2026`). */
function lastMonth() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { iso: first.toISOString().slice(0, 10), name: first.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

test.describe('Glaza', () => {
  test('a finance manager imports Glaza\u2019s CSV for last month and reads the statement', async ({ page }) => {
    test.skip(isRemoteTarget(), 'imports into the venue, so the local stack only');
    const month = lastMonth();
    const day = `${month.iso.slice(0, 8)}10`;
    const csv = ['time,table,seat,item,kind,quantity,unit_cost,unit_price,comp', `${day} 21:30,Table 3,,"Club sandwich, toasted",food,4,180,450,yes`,
      `${day} 22:00,Table 3,,Beer,alcohol,4,150,400,no`].join('\n');
    await signInToConsole(page, '9000000632');
    await page.getByRole('link', { name: 'Food and drink' }).click();
    await expect(page.getByRole('heading', { name: 'Glaza statement' })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: 'glaza.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.getByText(`2 lines imported for ${month.name}.`)).toBeVisible();
    await expect(page.getByText(/: 2 lines, \d+ matched to a visit by table and time\.$/)).toBeVisible();
    const table = page.getByRole('table', { name: 'Glaza statement' });
    await expect(table.getByRole('row', { name: /^Comps owed to Glaza\s*₹720$/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^Alcohol margin\s*₹1,000$/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^RIVR’s half of the margin\s*₹500$/ })).toBeVisible();
    await expect(table.getByRole('row', { name: /^NewCo’s payable to Glaza\s*₹220$/ })).toBeVisible();
  });
});
