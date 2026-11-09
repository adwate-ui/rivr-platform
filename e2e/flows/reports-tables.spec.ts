/**
 * Reports › Tables (8 Nov audit, I-77, F-107). Deepak Menon, this flow's own admin, reads every active table, the whole room under them, and
 * goes back 90 days or to dates of his own. The figures are proved in supabase/tests/389_table_metrics_compared.test.sql.
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
});
