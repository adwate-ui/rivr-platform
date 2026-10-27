/**
 * Cab (#140; scope-v1 module 14). Kabir Anand has four visits this month, so Rewards offers him a cab: he asks for a
 * pickup at 21:30 and sees it. Tara Singh has three, so she is offered none. The rule itself (cab.minimum_visits, four
 * unless set) is proved in supabase/tests/173_cab_requests.test.sql.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

test.describe('Cab', () => {
  test('Cab: four visits this month offers a pickup or drop; three does not', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'signs in seeded members, so the local stack only');
    const kabir = await browser.newPage();
    await signInToPlayer(kabir, '9000000620');
    await kabir.goto(`${appUrl('player')}/rewards`);
    await expect(kabir.getByRole('heading', { name: 'Cab' })).toBeVisible();
    await kabir.getByRole('textbox', { name: 'Where' }).fill('Sector 54, Golf Course Road');
    await kabir.getByRole('textbox', { name: /^At / }).fill('21:30');
    await kabir.getByRole('button', { name: 'Ask for the cab' }).click();
    await expect(kabir.getByRole('status').filter({ hasText: 'Asked: Pickup to the club at 21:30, Sector 54, Golf Course Road.' })).toBeVisible();

    const tara = await browser.newPage();
    await signInToPlayer(tara, '9000000621');
    await tara.goto(`${appUrl('player')}/rewards`);
    await expect(tara.getByRole('heading', { name: 'Rewards', level: 1 })).toBeVisible();
    await expect(tara.getByRole('heading', { name: 'Cab' })).toHaveCount(0);
  });
});
