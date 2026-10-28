/**
 * Growth funnel (#166; S-G3). The investor (owner_view) opens Reports and reads every member by where they came
 * from, with how many finished KYC, came in and bought in, and beside it each channel's followers (#164). The counts,
 * the sources and who may are proved in supabase/tests/175_growth_funnel.test.sql and 195_channel_metrics.test.sql.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Growth funnel', () => {
  test('Growth funnel: the investor reads sign-up to KYC to first visit to first buy-in by source', async ({ page }) => {
    // The investor's own number: no other flow signs in with it.
    await signInToConsole(page, '9000000109');
    await page.getByRole('link', { name: 'Reports' }).click();
    await page.getByRole('navigation', { name: 'Reports' }).getByRole('link', { name: 'Growth and channels' }).click();
    await expect(page.getByRole('heading', { name: 'Growth funnel', level: 2 })).toBeVisible();
    const funnel = page.getByRole('table', { name: 'Growth funnel' });
    for (const header of ['Source', 'Signed up', 'KYC done', 'Came in', 'Bought in']) {
      await expect(funnel.getByRole('columnheader', { name: header })).toBeVisible();
    }
    // The seed's members came with no link or code.
    await expect(funnel.getByRole('row').filter({ hasText: 'Direct' })).toBeVisible();
    // Each channel beside it: no channel is connected locally, so none is counted yet.
    const channels = page.getByRole('table', { name: 'Channels' });
    for (const header of ['Channel', 'Followers', 'In 30 days', 'Signed up from its links', 'KYC done', 'Bought in']) {
      await expect(channels.getByRole('columnheader', { name: header })).toBeVisible();
    }
    await expect(channels.getByRole('row').filter({ hasText: 'Instagram' })).toContainText('Not counted');
  });
});
