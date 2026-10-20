/**
 * Balance (#18; design prompt "Balance"). Arjun Mehta, this flow's own member (Auth sends one code a
 * minute to a number), opens Balance: ₹1,85,000 of cash, his ₹4,000 bonus expiring Sunday and 18,420
 * points together, his open ₹50,000 marker against a ₹2,00,000 limit, and the seed's opening balances
 * among his movements. Who sees which lines is proved in supabase/tests/062_wallet.test.sql.
 */
import { expect, test } from '@playwright/test';
import { signInToPlayer } from '../support/signIn.ts';

test.describe('Balance', () => {
  test('Balance: a member sees cash, bonus with its expiry and points together, open markers against the limit, and movements', async ({ page }) => {
    await signInToPlayer(page, '9000000201');
    await page.getByRole('link', { name: 'Balance' }).click();
    await expect(page.getByRole('heading', { name: 'Balance', level: 1 })).toBeVisible();
    await expect(page.getByText('₹1,85,000', { exact: true })).toBeVisible();
    await expect(page.getByText(/^₹4,000 bonus · expires Sunday 23:59$/)).toBeVisible();
    await expect(page.getByText('18,420 points', { exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Markers' })).toBeVisible();
    await expect(page.getByText(/^Issued \d{1,2} [A-Z][a-z]{2} · due \d{1,2} [A-Z][a-z]{2}$/)).toBeVisible();
    await expect(page.getByText('₹50,000', { exact: true })).toBeVisible();
    await expect(page.getByText('Limit ₹2,00,000 · available ₹1,50,000', { exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Movements' })).toBeVisible();
    await expect(page.getByText('Opening balance', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('+₹1,85,000', { exact: true })).toBeVisible();
    await expect(page.getByText('+₹4,000', { exact: true })).toBeVisible();
    await expect(page.getByText('₹50,000 owed', { exact: true })).toBeVisible();
  });
});
