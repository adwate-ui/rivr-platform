/**
 * The social wall (#157; decision 0267). Ira Sethi, this flow's own marketing manager, approves a post that tags the
 * club, which the seed holds as Instagram's pull would; the website's home page then shows it on its wall. The pull,
 * rejections, the TV and the practice venue are proved in supabase/tests/184_social_wall.test.sql and the display's
 * SocialWallMode test.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Social wall', () => {
  test('marketing approves a tagged post and the website shows it', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'moderates the seed\u2019s posts, so the local stack only');
    await signInToConsole(page, '9000000635');
    await page.getByRole('link', { name: 'Social' }).click();
    const queue = page.getByRole('table', { name: 'Tagged posts' });
    const row = queue.getByRole('row').filter({ hasText: '@zoya.plays' });
    await expect(row).toBeVisible();
    const approve = page.getByRole('button', { name: 'Approve @zoya.plays’s post' });
    if (await approve.isEnabled()) await approve.click();
    await expect(row).toContainText('On the wall');

    const site = await browser.newPage();
    await site.goto(appUrl('web'));
    await expect(site.getByRole('heading', { name: 'On Instagram' })).toBeVisible();
    await expect(site.getByText('@zoya.plays')).toBeVisible();
    await expect(site.getByText('@kabir.s')).toHaveCount(0);
  });
});
