/**
 * Check-out (#82; features "Check-in and check-out"; additions flow 14). Deepa Kulkarni, this flow's own
 * front desk, checks Varun Malhotra in by his number and out from the room list as he leaves; then in again
 * and out by the number on his card, which closes his visit and counts its hours and points. A member who
 * owes call time is refused at the door until an admin lets them go, and the points a closed visit earns,
 * are proved in supabase/tests/084_check_out.test.sql.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** One of the door's lists, found by its heading. */
function doorList(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByRole('heading', { name, level: 2 }) }).last();
}

test.describe('Check-out', () => {
  test('Check-out: the front desk checks a member out from the room list and by the number on his card', async ({ page }) => {
    test.skip(isRemoteTarget(), 'opens and closes visits, so the local stack only');
    await signInToConsole(page, '9000000158');
    await page.getByRole('link', { name: 'Check-in' }).click();
    const phone = page.getByRole('textbox', { name: 'Mobile number' });

    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(doorList(page, 'In the room').getByText('Varun Malhotra')).toBeVisible();
    await page.getByRole('button', { name: 'Check out Varun Malhotra' }).click();
    await expect(doorList(page, 'In the room').getByText('Varun Malhotra')).toHaveCount(0);

    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect(doorList(page, 'In the room').getByText('Varun Malhotra')).toBeVisible();
    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('Checked out. Their hours and points are counted.')).toBeVisible();
    await expect(doorList(page, 'In the room').getByText('Varun Malhotra')).toHaveCount(0);

    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('This member is not checked in, so there is no visit to close.')).toBeVisible();
  });
});
