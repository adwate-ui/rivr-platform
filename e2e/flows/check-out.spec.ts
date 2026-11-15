/**
 * Check-out (#82; features "Check-in and check-out"; additions flow 14). Deepa Kulkarni, this flow's own
 * front desk, checks Varun Malhotra in by his number and out from the room list as he leaves; then in again
 * and out by the number on his card, which closes his visit and counts its hours. A member who owes call
 * time is refused at the door until an admin lets them go, which supabase/tests/084_check_out.test.sql proves.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** The door's table (redesign RD-30), showing the list its chip names: In the room when the screen opens. */
async function doorList(page: Page, name: string): Promise<Locator> {
  await page.getByRole('radiogroup', { name: 'List' }).getByRole('radio', { name: new RegExp(`^${name}`) }).click();
  return page.getByRole('table', { name: 'At the door today' });
}

test.describe('Check-out', () => {
  test('Check-out: the front desk checks a member out from the room list and by the number on his card', async ({ page }) => {
    test.skip(isRemoteTarget(), 'opens and closes visits, so the local stack only');
    await signInToConsole(page, '9000000158');
    await page.getByRole('link', { name: 'Door', exact: true }).click();
    // One field for a card, a mobile, a member number or a name (console v3).
    const phone = page.getByRole('textbox', { name: 'Name, mobile or member number' });

    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect((await doorList(page, 'In the room')).getByText('Varun Malhotra')).toBeVisible();
    await page.getByRole('button', { name: 'Check out Varun Malhotra' }).click();
    await expect((await doorList(page, 'In the room')).getByText('Varun Malhotra')).toHaveCount(0);

    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check in', exact: true }).click();
    await expect((await doorList(page, 'In the room')).getByText('Varun Malhotra')).toBeVisible();
    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('Checked out.')).toBeVisible();
    await expect((await doorList(page, 'In the room')).getByText('Varun Malhotra')).toHaveCount(0);

    await phone.fill('9000000253');
    await page.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(page.getByText('Not checked in.')).toBeVisible();
  });
});
