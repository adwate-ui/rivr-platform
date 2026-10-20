/**
 * Purge (#104; additions flow 16): the owner, a super admin, runs reset to seed on the practice venue. The
 * dry run lists each table's rows now and in the seed; a name not typed exactly is refused; typed exactly,
 * the venue is back to its seed and every table matches it. The club is never reset (the owner's decision
 * on #104). Earlier flows have played at the practice venue, so there is something to reset.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Purge', () => {
  test('Purge: a super admin resets the practice venue to its seed, typing its name', async ({ page }) => {
    test.skip(isRemoteTarget(), 'resets the practice venue, so the local stack only');
    await signInToConsole(page, '9000000101');
    const rail = page.getByRole('complementary');
    await rail.getByRole('switch', { name: 'Practice venue' }).click();
    await expect(rail.getByText('RIVR Practice')).toBeVisible();
    await page.getByRole('link', { name: 'Practice reset' }).click();

    const table = page.getByRole('table', { name: 'Tables a reset reloads' });
    await expect(table.getByRole('cell', { name: 'member', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'staff', exact: true })).toHaveCount(0);

    const name = page.getByRole('textbox', { name: 'Type the venue\'s name to confirm' });
    await name.fill('RIVR practice');
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    await expect(page.getByText('Type the venue\'s name exactly as the rail shows it.')).toBeVisible();

    await name.fill('RIVR Practice');
    await page.getByRole('button', { name: 'Reset to seed' }).click();
    await expect(page.getByText('The practice venue is back to its seed.')).toBeVisible();
    await expect(page.getByText('Every table matches the seed.')).toBeVisible();
  });
});
