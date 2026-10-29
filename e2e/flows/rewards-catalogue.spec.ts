/**
 * The rewards catalogue on the console (#145; decision 0181). Tanya Rao, this flow's own marketing manager, opens
 * Rewards, adds a cap of her own to the catalogue, finds it live, and takes it off offer. The League's console screen
 * is hidden (#626); its sums stay proved in supabase/tests/100_league.test.sql. That members redeem only from their
 * tier's catalogue, at the price shown and never below nothing, is proved in supabase/tests/099_rewards_catalogue.test.sql.
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
  test('Marketing adds a reward and takes it off offer, and the League is off the rail', async ({ browser }) => {
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

    await expect(marketing.getByRole('link', { name: 'League', exact: true })).toHaveCount(0);
  });
});
