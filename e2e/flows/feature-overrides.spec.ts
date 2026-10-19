/**
 * Feature overrides (#61; additions flow 21, the override). Kavya Menon, this flow's own super admin
 * (Auth sends one code a minute to a number), opens Kabir Sethi's record and takes Learn away from him
 * alone, with a reason: his Learn tab shows it locked. She lifts it, with a reason, and his tier decides
 * again. That only super admins see overrides, and the member's own, is proved in
 * supabase/tests/059_feature_overrides.test.sql; the matrix side of flow 21 is #32's.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Feature overrides', () => {
  test('a super admin takes Learn away from one member with a reason, and lifts it', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'changes a member\'s features, so the local stack only');
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000134');
    await admin.getByRole('link', { name: 'Members' }).click();
    await admin.getByRole('searchbox', { name: 'Find a member' }).fill('Kabir');
    await admin.getByRole('button', { name: 'Open Kabir Sethi' }).click();
    await expect(admin.getByRole('heading', { name: 'Feature overrides' })).toBeVisible();
    await admin.getByRole('group', { name: 'Feature' }).getByRole('button', { name: 'Learn library' }).click();
    await admin.getByRole('group', { name: 'Override' }).getByRole('button', { name: 'Take away' }).click();
    await admin.getByRole('textbox', { name: 'Why the override' }).fill('Sharing drills outside the club');
    await admin.getByRole('button', { name: 'Save override' }).click();
    await expect(admin.getByText('Override saved.')).toBeVisible();
    await expect(admin.getByText(/^Learn library taken away · Sharing drills outside the club · by Kavya Menon$/)).toBeVisible();

    const player = await browser.newPage();
    await signInToPlayer(player, '9000000202');
    await expect(player.getByRole('link', { name: 'Learn' })).toHaveAccessibleDescription(/ only\.$/);

    await admin.getByRole('button', { name: 'Lift the override of Learn library' }).click();
    await admin.getByRole('textbox', { name: 'Why it is lifted' }).fill('Sorted out with the owner');
    await admin.getByRole('button', { name: 'Lift', exact: true }).click();
    await expect(admin.getByText('Override lifted.')).toBeVisible();
    await expect(admin.getByText('Lifted by Kavya Menon: Sorted out with the owner')).toBeVisible();
    await player.reload();
    await expect(player.getByRole('link', { name: 'Learn' })).not.toHaveAccessibleDescription(/ only\.$/);
  });
});
