/**
 * Check-in (#72; features "Check-in and check-out"; the prototype's console Check-in). Sunita Pillai,
 * this flow's own front desk (Auth sends one code a minute to a number), checks Naina Kapoor in from
 * the expected list (she is on the 100/200 list from the seed) and Rohan Bhatia by his mobile number;
 * both move to In the room, the number's with "Checked in.", and a number no member has is refused with the reason. A member on a
 * break is refused at the door in supabase/tests/047_visits.test.sql. Check-out is the Check-out flow's
 * (#82); this one runs on a freshly seeded local stack.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** One of the door's lists, a region named by its heading (console v3). */
function doorList(page: Page, name: string): Locator {
  return page.getByRole('region', { name });
}

test.describe('Check-in', () => {
  test('the front desk checks in an expected member and one by mobile number', async ({ page }) => {
    test.skip(isRemoteTarget(), 'opens visits that only check-out (#82) closes, so the local stack only');
    await signInToConsole(page, '9000000124');
    await page.getByRole('link', { name: 'Door', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check-in', level: 2 })).toBeVisible();

    await expect(doorList(page, 'Expected tonight').getByText('Naina Kapoor')).toBeVisible();
    await page.getByRole('button', { name: 'Check in Naina Kapoor' }).click();
    await expect(doorList(page, 'In the room').getByText('Naina Kapoor')).toBeVisible();
    await expect(doorList(page, 'Expected tonight').getByText('Naina Kapoor')).toHaveCount(0);

    // One field for a card, a mobile, a member number or a name (console v3).
    const field = page.getByRole('textbox', { name: 'Card, name, mobile or member number' });
    await field.fill('9000000204');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(page.getByText('Checked in.')).toBeVisible();
    await expect(doorList(page, 'In the room').getByText('Rohan Bhatia')).toBeVisible();
    await expect(doorList(page, 'Expected tonight').getByText('Rohan Bhatia')).toHaveCount(0);

    await field.fill('9000000999');
    await field.press('Enter');
    await expect(page.getByText('No member has that number. Sign them up first.')).toBeVisible();
    await expect(page.getByText('Checked in.')).toHaveCount(0);
  });
});
