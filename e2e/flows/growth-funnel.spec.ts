/**
 * Growth funnel (#166; S-G3). The investor (owner_view) opens Reports and reads every member by where they came
 * from, with how many finished KYC, came in and bought in. The counts, the sources and who may are proved in
 * supabase/tests/175_growth_funnel.test.sql.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Growth funnel', () => {
  test('Growth funnel: the investor reads sign-up to KYC to first visit to first buy-in by source', async ({ page }) => {
    // The investor's own number: no other flow signs in with it.
    await signInToConsole(page, '9000000109');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByRole('heading', { name: 'Growth funnel', level: 2 })).toBeVisible();
    const funnel = page.getByRole('table', { name: 'Growth funnel' });
    for (const header of ['Source', 'Signed up', 'KYC done', 'Came in', 'Bought in']) {
      await expect(funnel.getByRole('columnheader', { name: header })).toBeVisible();
    }
    // The seed's members came with no link or code.
    await expect(funnel.getByRole('row').filter({ hasText: 'Direct' })).toBeVisible();
  });
});
