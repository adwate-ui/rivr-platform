/**
 * Creators (#163; scope-v1 "Growth"). Rohan Das, this flow's own marketing manager, adds a creator at ₹500 a first
 * buy-in and reads their dashboard: their link, no sign-ups yet and nothing owed. Attribution, the counts and what
 * is owed are proved in supabase/tests/177_creators.test.sql.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Creators', () => {
  test('Creators: marketing adds a creator with a commission and reads their dashboard', async ({ page }) => {
    const code = `E2E${String(Date.now()).slice(-6)}`;
    await signInToConsole(page, '9000000628');
    await page.getByRole('link', { name: 'Creators' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Zoya Khan');
    await page.getByRole('textbox', { name: 'Code' }).fill(code);
    await page.getByRole('group', { name: 'Paid on' }).getByRole('button', { name: 'First buy-in' }).click();
    await page.getByRole('textbox', { name: 'Commission' }).fill('500');
    await page.getByRole('button', { name: 'Add creator' }).click();
    await expect(page.getByText(`Zoya Khan is added. Their links carry ?creator=${code}.`)).toBeVisible();
    const row = page.getByRole('table', { name: 'Creators' }).getByRole('row').filter({ hasText: code });
    await expect(row).toContainText(`?creator=${code}`);
    await expect(row).toContainText('₹500 a first buy-in');
  });
});
