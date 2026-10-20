/**
 * Check-in (#72; features "Check-in and check-out"; the prototype's console Check-in). Sunita Pillai,
 * this flow's own front desk (Auth sends one code a minute to a number), checks Naina Kapoor in from
 * the expected list (she is on the 100/200 list from the seed) and Rohan Bhatia by his mobile number;
 * both move to In the room, and a number no member has is refused with the reason. A member on a
 * break is refused at the door in supabase/tests/047_visits.test.sql. Check-out is the Check-out flow's
 * (#82); this one runs on a freshly seeded local stack.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** One of the door's lists, found by its heading. */
function doorList(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByRole('heading', { name, level: 2 }) }).last();
}

test.describe('Check-in', () => {
  test('the front desk checks in an expected member and one by mobile number', async ({ page }) => {
    test.skip(isRemoteTarget(), 'opens visits that only check-out (#82) closes, so the local stack only');
    await signInToConsole(page, '9000000124');
    await page.getByRole('link', { name: 'Check-in' }).click();
    await expect(page.getByRole('heading', { name: 'Check-in', level: 1 })).toBeVisible();

    await expect(doorList(page, 'Expected').getByText('Naina Kapoor')).toBeVisible();
    await page.getByRole('button', { name: 'Check in Naina Kapoor' }).click();
    await expect(doorList(page, 'In the room').getByText('Naina Kapoor')).toBeVisible();
    await expect(doorList(page, 'Expected').getByText('Naina Kapoor')).toHaveCount(0);

    const phone = page.getByRole('textbox', { name: 'Mobile number' });
    await phone.fill('9000000204');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(doorList(page, 'In the room').getByText('Rohan Bhatia')).toBeVisible();
    await expect(doorList(page, 'Expected').getByText('Rohan Bhatia')).toHaveCount(0);

    await phone.fill('9000000999');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(page.getByText('No member has that number. Sign them up first.')).toBeVisible();
  });
});
