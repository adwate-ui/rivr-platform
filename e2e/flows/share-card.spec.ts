/**
 * Refer a friend (#153; decision 0320). Zoya Merchant, this flow's own member, opens Rewards: her referral code, her own
 * random one (#562), large on her card. Her link, which a friend signs up from, carries the code; Copy link copies it and a
 * toast says so. Share invite hands the link to the phone's share sheet, or copies it where there is none, as on a
 * desktop browser. The referral itself (#151) is proved in supabase/tests/166_referral_programme.test.sql.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

test.describe('Share card', () => {
  test('Sessions, card, rewards › Rewards: a member copies her referral link, with her code, and shares her invite', async ({ page }) => {
    test.skip(isRemoteTarget(), 'signs in a seeded member, so the local stack only');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInToPlayer(page, '9000000299');
    await page.goto(`${appUrl('player')}/rewards`);
    await expect(page.getByText('Refer a friend', { exact: true })).toBeVisible();
    // Her own random code (#562): eight letters and digits, with no 0, O, 1, I or L.
    const code = await page.getByText(/^[2-9A-HJKMNP-Z]{8}$/).textContent();
    await expect(page.getByText(/^\d+ joined$/)).toBeVisible();

    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Invite link copied')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${appUrl('player')}/?ref=${code}`);

    // No share sheet on a desktop browser: Share invite copies the link instead.
    await page.evaluate(() => navigator.clipboard.writeText(''));
    await page.getByRole('button', { name: 'Share invite' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`${appUrl('player')}/?ref=${code}`);
  });
});
