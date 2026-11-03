/**
 * Phone change (#502; decision 0248). Kiran Joshi, this flow's own super admin (Auth sends one code a minute to a
 * number), changes the practice member Omar Sheikh's number at the desk: a number without +91 is refused, and the
 * new one with a reason is changed. That the login moves with it, that it is audited and alerted, and that the
 * sign-in hook sends no code for a member's own change, is proved in supabase/tests/155_member_phone_change.test.sql
 * and packages/adapters/src/sign-in-code/hook.test.ts.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Phone change', () => {
  test('a super admin changes a practice member\'s number, with a reason', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes a member\'s number, so the local stack only');
    await signInToConsole(page, '9000000780');
    // The practice venue switch is in the account menu (console v3); a stripe across the top says it is on.
    await page.getByRole('button', { name: 'Kiran Joshi', exact: true }).click();
    await page.getByRole('switch', { name: 'Practice venue' }).click();
    await expect(page.getByText('Practice venue: nothing here reaches the club or its members.')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Members' }).click();
    await page.getByRole('searchbox', { name: 'Name, member no. or mobile' }).fill('Omar');
    await page.getByRole('button', { name: 'Omar Sheikh', exact: true }).click();
    // The record's parts are tabs (C-02).
    await page.getByRole('link', { name: 'Account', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Phone number' })).toBeVisible();
    const number = page.getByRole('textbox', { name: 'New mobile number' });
    const again = page.getByRole('textbox', { name: 'Type the new number again' });
    const change = page.getByRole('button', { name: 'Change number' });
    await number.fill('9000000782');
    await again.fill('9000000782');
    await page.getByRole('textbox', { name: 'Why it changes' }).fill('Lost his phone; new SIM');
    await change.click();
    await page.getByRole('button', { name: 'Yes, change it to 9000000782' }).click();
    await expect(page.getByText('An Indian mobile with +91, and a reason without names or numbers.')).toBeVisible();

    await number.fill('+919000000782');
    await again.fill('+919000000782');
    await change.click();
    await page.getByRole('button', { name: 'Yes, change it to +919000000782' }).click();
    await expect(page.getByText('Changed.')).toBeVisible();
  });
});
