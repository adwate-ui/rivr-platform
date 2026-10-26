/**
 * The rewards catalogue and the League on the console (#145, #147; decisions 0181, 0182). Tanya Rao, this
 * flow's own marketing manager, opens Growth → Rewards, adds a cap of her own to the catalogue, finds it
 * live, and takes it off offer. On Growth → League she keeps the seasons and sees the seeded one, but no
 * names. Kabir Anand, its floor manager, who reads members, sees this month's standings and the season's.
 * That members redeem only from their tier's catalogue, at the price shown and never below nothing, is
 * proved in supabase/tests/099_rewards_catalogue.test.sql; the League's sums in 100_league.test.sql.
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
  test('Marketing adds a reward and takes it off offer; the floor manager reads the League by month and season', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'changes the catalogue, so the local stack only');
    const marketing = await browser.newPage();
    await signInToConsole(marketing, '9000000700');
    await marketing.getByRole('link', { name: 'Rewards', exact: true }).click();
    await expect(marketing.getByText('Sunday Main Event seat', { exact: true })).toBeVisible({ timeout: 10_000 });

    const name = `RIVR cap ${String(Date.now() % 100_000).padStart(5, '0')}`;
    await addCap(marketing, name);
    await marketing.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Merchandise' }).click();
    await expect(marketing.getByText(name, { exact: true })).toBeVisible();
    await expect(marketing.getByText('Sunday Main Event seat', { exact: true })).toHaveCount(0);

    await marketing.getByRole('button', { name: `Edit ${name}` }).click();
    await expect(marketing.getByRole('heading', { name: `Edit ${name}` })).toBeVisible();
    await marketing.getByRole('switch', { name: 'On offer' }).click();
    await marketing.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(marketing.getByRole('heading', { name: 'New reward' })).toBeVisible();
    await expect(marketing.getByText('Retired', { exact: true }).first()).toBeVisible();

    await marketing.getByRole('link', { name: 'League', exact: true }).click();
    await expect(marketing.getByText(/^Season one · /)).toBeVisible({ timeout: 10_000 });
    await expect(marketing.getByText('Standings by name are for staff who read members.')).toBeVisible();

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000701');
    await floor.getByRole('link', { name: 'League', exact: true }).click();
    const period = floor.getByRole('group', { name: 'Standings for' });
    await expect(period.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
    await period.getByRole('button', { name: 'Season one' }).click();
    // The seed's season runs from this month: its table, or no points yet.
    await expect(floor.getByRole('table', { name: 'Season one' }).or(floor.getByText('No League points yet for this period.'))).toBeVisible();
  });
});
