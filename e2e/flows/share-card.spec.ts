/**
 * Share card (#153; tech plan item 9). Zoya Merchant, this flow's own member, opens Rewards: her referral code, RIVR
 * and her member number, and her card with it. Sharing draws the card as a PNG; a desktop browser cannot share a file,
 * so it is saved, named for her code. The referral itself (#151) is proved in supabase/tests/166_referral_programme.test.sql.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

test.describe('Share card', () => {
  test('a member shares her referral card, with her code', async ({ page }) => {
    test.skip(isRemoteTarget(), 'signs in a seeded member, so the local stack only');
    await signInToPlayer(page, '9000000299');
    await page.goto(`${appUrl('player')}/rewards`);
    await expect(page.getByRole('heading', { name: 'Refer a friend' })).toBeVisible();
    const code = await page.getByText(/^RIVR\d+$/).textContent();
    await expect(page.getByRole('img', { name: `Referral card with the code ${code}` })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Share my card' }).click();
    expect((await download).suggestedFilename()).toBe(`rivr-referral-${code}.png`);
  });
});
