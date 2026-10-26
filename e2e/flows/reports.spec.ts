/**
 * Reports (#99; decision 0188). Arjun Mehra, the owner (owner_view), opens Reports: tonight's rake by
 * table, dealer and game, or that no hands are logged yet, then the monthly investor MIS for this month
 * (a preview until the 1st) and the month before. The figures, the club month's bounds, the stored MIS
 * and who may are proved in supabase/tests/121_reports_and_mis.test.sql.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Reports', () => {
  test('Reports: the owner reads tonight\'s rake by table, dealer and game, and the monthly MIS', async ({ page }) => {
    await signInToConsole(page, '9000000198');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Reports', level: 1 })).toBeVisible();
    // Tonight's tables, or their empty message when no flow before this one has logged a hand tonight.
    for (const label of ['Tonight by table', 'Tonight by dealer', 'Tonight by game']) {
      await expect(page.getByRole('table', { name: label }).or(page.getByText('No hands yet tonight.')).first()).toBeVisible();
    }
    await expect(page.getByText(/so far\. It is stored on the 1st/)).toBeVisible();
    await expect(page.getByRole('table', { name: 'The month' }).getByRole('row').filter({ hasText: 'Net' })).toBeVisible();

    const months = page.getByRole('group', { name: 'Month' }).getByRole('button');
    await months.nth(1).click();
    await expect(page.getByText(/was not stored on the 1st|^Stored /)).toBeVisible();
    await expect(page.getByRole('table', { name: 'The month' }).getByRole('row').filter({ hasText: 'Hands' })).toBeVisible();
  });
});
