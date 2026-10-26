/**
 * The rewards catalogue and the League on the console (#145, #147; decisions 0181, 0182). Tanya Rao, this
 * flow's own marketing manager, opens Growth → Rewards, adds a cap of her own to the catalogue, finds it
 * live, and takes it off offer. On Growth → League she sees this month's standings and the seeded season,
 * and its standings. That members redeem only from their tier's catalogue, and points never go below
 * nothing, is proved in supabase/tests/099_rewards_catalogue.test.sql; the League's sums in 100_league.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** Fills the reward form with a merchandise item and saves it. */
async function addCap(page: Page, name: string) {
  await expect(page.getByRole('heading', { name: 'New reward' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('group', { name: 'Kind' }).getByRole('button', { name: 'Merchandise' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);
  await page.getByRole('textbox', { name: 'Where to collect it' }).fill('At the host desk');
  await page.getByRole('textbox', { name: 'Points' }).fill('4000');
  await page.getByRole('textbox', { name: 'How many are left' }).fill('5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(`${name} is saved.`)).toBeVisible();
}

test.describe('Rewards catalogue', () => {
  test('Marketing adds a reward, takes it off offer, and reads the League by month and season', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes the catalogue, so the local stack only');
    await signInToConsole(page, '9000000700');
    await page.getByRole('link', { name: 'Rewards', exact: true }).click();
    await expect(page.getByText('Sunday Main Event seat', { exact: true })).toBeVisible({ timeout: 10_000 });

    const name = `RIVR cap ${String(Date.now() % 100_000).padStart(5, '0')}`;
    await addCap(page, name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(page.getByText('5 left', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: `Edit ${name}` }).click();
    await expect(page.getByRole('heading', { name: `Edit ${name}` })).toBeVisible();
    await page.getByRole('switch', { name: 'On offer' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New reward' })).toBeVisible();
    await expect(page.getByText('Retired', { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: 'League', exact: true }).click();
    const period = page.getByRole('group', { name: 'Standings for' });
    await expect(period.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    await expect(page.getByText(/^Season one · /)).toBeVisible();
    await period.getByRole('button', { name: 'Season one' }).click();
    // The seed's season runs from this month: its table, or no points yet.
    await expect(page.getByRole('table', { name: 'Season one' }).or(page.getByText('No League points yet for this period.'))).toBeVisible();
  });
});
