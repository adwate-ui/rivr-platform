/**
 * The spin wheel (#150; decision 0266), a tab of Rewards (console v3). Kunal Sethi, this flow's own duty manager (a super
 * admin: the floor and promotions), clears the wheel, puts 100 points on it, and spins it for Tara Bose, whose spin from
 * Spin the wheel the seed gives: with one prize on the wheel she wins it, its odds 1 in 1. Odds, the budget, bonus prizes
 * and the TV are proved in supabase/tests/183_spin_wheel.test.sql and the display's SpinMode test; why a prize is off the
 * wheel in the console's PrizeWheel test.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Spin wheel', () => {
  test('the floor puts a prize on the wheel and spins it for a member', async ({ page }) => {
    test.skip(isRemoteTarget(), 'spins the seed member\u2019s spin, so the local stack only');
    await signInToConsole(page, '9000000633');
    await page.getByRole('link', { name: 'Rewards', exact: true }).click();
    await page.getByRole('link', { name: 'Spin wheel', exact: true }).click();
    const wheel = page.getByRole('table', { name: 'The wheel' });
    await expect(wheel.or(page.getByText('No prizes on the wheel yet.'))).toBeVisible();
    // Each prize's Remove is asked twice (F2-21).
    const removes = page.getByRole('button', { name: /^Remove / });
    for (let left = await removes.count(); left > 0; left -= 1) {
      await removes.first().click();
      await page.getByRole('button', { name: /^Yes, remove / }).click();
      await expect(removes).toHaveCount(left - 1);
    }
    await expect(page.getByText('No prizes on the wheel yet.')).toBeVisible();

    await page.getByRole('radiogroup', { name: 'Prize' }).getByRole('radio', { name: 'Points' }).click();
    await page.getByRole('textbox', { name: 'Points' }).fill('100');
    await page.getByRole('textbox', { name: 'Weight' }).fill('1');
    await page.getByRole('button', { name: 'Add to the wheel' }).click();
    await expect(page.getByText('100 points is on the wheel.')).toBeVisible();
    await expect(wheel.getByRole('row', { name: /100 points.*1 in 1/ })).toBeVisible();

    await page.getByRole('button', { name: 'Spin for Tara Bose' }).click();
    await expect(page.getByText('Tara Bose won 100 points.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Spin for Tara Bose' })).toHaveCount(0);
  });
});
