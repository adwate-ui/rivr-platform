/**
 * Live floor (#81; design prompt "Live floor"; the prototype's console). Meera Chopra, this flow's own
 * floor manager (Auth sends one code a minute to a number), opens the live floor: rake tonight and how
 * many are seated; the main room's tables and the Private Room, each a card with its ring, occupancy,
 * rake, dealer and hands per hour. Pressing Table 4's card opens it: its rules, its night so far, its
 * seats and its recent hands. The figures with hands logged (rake, hands, per hour, dealer, recent
 * hands) are proved in supabase/tests/052_live_floor.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Live floor', () => {
  test('the room plan shows every table by room, and a card opens its table with its night and recent hands', async ({ page }) => {
    test.skip(isRemoteTarget(), 'reads the seeded floor, so the local stack only');
    await signInToConsole(page, '9000000129');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    await expect(page.getByText('Rake tonight', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^\d+ seated$/)).toBeVisible();
    await expect(page.getByText('Main room', { exact: true })).toBeVisible();
    // The room's label, and the felt of the table named for it.
    await expect(page.getByText('Private Room', { exact: true }).first()).toBeVisible();
    const plan = page.getByRole('region', { name: 'Room plan' });
    for (const name of ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Private Room']) {
      await expect(plan.getByRole('button', { name, exact: true })).toBeVisible();
    }

    const table4 = plan.getByRole('button', { name: 'Table 4', exact: true });
    await table4.click();
    await expect(table4).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Table 4', level: 2 })).toBeVisible();
    await expect(page.getByText('100/200 · buy-in ₹10,000 · rake 5%, cap ₹6,000')).toBeVisible();
    await expect(page.getByText('Hands', { exact: true })).toBeVisible();
    await expect(page.getByText('Per hour', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent hands' })).toBeVisible();
    await expect(page.getByText('No hands yet tonight.')).toBeVisible();
    // Closed, its seats are simply open; at an open table they invite a call from the waitlist.
    await expect(page.getByText('Open · call the waitlist')).toHaveCount(0);
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 5', exact: true }).click();
    await expect(page.getByText('Open · call the waitlist').first()).toBeVisible();
  });
});
