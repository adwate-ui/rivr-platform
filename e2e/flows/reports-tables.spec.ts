/**
 * Reports › Tables (8 Nov audit, I-77, F-107). Deepak Menon, this flow's own admin, reads every active table, the whole room under them, and
 * goes back 90 days or to dates of his own. The figures are proved in supabase/tests/389_table_metrics_compared.test.sql.
 * Then Players, Waitlist, Food and drink and Bonus (redesign RD-27), each with its four figures, its chart and its table over the same
 * period, and no rupee on any of them; their figures are proved in supabase/tests/439_reports_players_waitlist_food_and_bonus.test.sql.
 */
import { expect, test } from '@playwright/test';
import { openConsole } from '../support/console.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Reports', () => {
  test('Reports: Tables lists every active table, adds up the room, and goes back 90 days or to chosen dates', async ({ page }) => {
    await signInToConsole(page, '9000000172');
    await openConsole(page, '/reports');
    const table = page.getByRole('table', { name: 'Tables' });
    await expect(table.getByRole('row').last()).toContainText('All tables');
    await expect(table.getByText('Table 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Change is player hours against the 7 days before.')).toBeVisible();
    await page.getByRole('radio', { name: 'Last 90 days' }).click();
    await expect(page.getByText('Change is player hours against the 90 days before.')).toBeVisible();
    await page.getByRole('radio', { name: 'Choose dates' }).click();
    await expect(page.getByLabel('From')).toBeVisible();
    await expect(page.getByText('Change is player hours against the 30 days before.')).toBeVisible();
    await page.getByLabel('From').fill('2020-01-01');
    await expect(page.getByText('Choose a From on or before To, up to 92 days, and none ahead of tonight.')).toBeVisible();
    await expect(table.getByRole('row').last()).toContainText('All tables');
  });

  test('Reports: Players, Waitlist, Food and drink and Bonus each show figures, a chart and a table over the period, with no rupee', async ({ page }) => {
    // The same admin: Auth sends one code a minute to a number, so this waits out the first test's.
    test.setTimeout(150_000);
    await page.waitForTimeout(65_000);
    await signInToConsole(page, '9000000172');
    await openConsole(page, '/reports');
    const tabs = page.getByRole('navigation', { name: 'Reports' });
    // Tables has its figures and chart too.
    await expect(page.locator('dt').filter({ hasText: /^Seat use$/ })).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Seated by day' })).toBeVisible();
    const reports = [
      { tab: 'Players', figures: ['Check-ins', 'New members', 'Avg session'], chart: 'Check-ins', row: 'Members who played' },
      { tab: 'Waitlist', figures: ['Joined a list', 'Got a seat', 'Avg wait', 'Longest wait'], chart: 'Joined a list', row: 'Table 1' },
      { tab: 'Food and drink', figures: ['Orders', 'Items', 'Avg to accept', 'Avg to serve'], chart: 'Orders', row: null },
      { tab: 'Bonus', figures: ['Bonus given', 'Bonus used', 'Outstanding'], chart: 'Bonus given', row: null },
    ];
    for (const report of reports) {
      await tabs.getByRole('link', { name: report.tab, exact: true }).click();
      await expect(page).toHaveURL(/\/reports\?tab=/);
      for (const figure of report.figures) await expect(page.locator('dt').filter({ hasText: new RegExp(`^${figure}$`) })).toBeVisible();
      await expect(page.getByRole('figure', { name: `${report.chart} by day` })).toBeVisible();
      const lines = page.getByRole('table', { name: report.tab }).or(page.getByText(/^No (orders|Bonus given)\.$/)).first();
      await expect(lines).toBeVisible();
      if (report.row !== null) await expect(page.getByRole('table', { name: report.tab }).getByText(report.row, { exact: true })).toBeVisible();
      await expect(page.getByText(/₹/)).toHaveCount(0);
    }
    // The period is one for all: tonight on Bonus is tonight on Players, a bar an hour.
    await page.getByRole('radio', { name: 'Tonight' }).click();
    await expect(page.getByRole('figure', { name: 'Bonus given by hour' })).toBeVisible();
    await tabs.getByRole('link', { name: 'Players', exact: true }).click();
    await expect(page.getByRole('figure', { name: 'Check-ins by hour' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Tonight' })).toBeChecked();
    // Players lists every visit too, as the door lists the day, with an Export of its own (decision 0682).
    await expect(page.getByRole('table', { name: 'Visits' })).toBeVisible();
    await page.getByRole('button', { name: 'Export Players', exact: true }).click();
  });
});
