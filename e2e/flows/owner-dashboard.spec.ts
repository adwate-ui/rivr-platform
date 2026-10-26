/**
 * The owner dashboard (#101; decision 0192). Vikram Oberoi, an owner (owner_view), opens Owner: tonight's
 * rake, the tables running and the room, the rake by night, the cash position and the latest alerts. The
 * figures, who may and the live topic are proved in supabase/tests/124_owner_dashboard.test.sql.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Owner dashboard', () => {
  test('Owner dashboard: the owner reads tonight, the room, the cash position and alerts on a phone', async ({ page }) => {
    await signInToConsole(page, '9000000611');
    await page.getByRole('link', { name: 'Owner', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Owner', level: 1 })).toBeVisible();
    await expect(page.getByText('Rake tonight', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Tables running')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Accounts and what they hold' }).or(page.getByText('No payment accounts yet.'))).toBeVisible();
    await expect(page.getByRole('table', { name: 'The latest alerts' }).or(page.getByText('No alerts.'))).toBeVisible();
    await expect(page.getByText('Rake by night').first()).toBeVisible();
  });
});
