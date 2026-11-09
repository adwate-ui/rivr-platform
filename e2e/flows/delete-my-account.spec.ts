/**
 * Delete my account (decision 0574). Kiran Joshi asks from Profile: what it does, then Send request, and the row shows when he
 * asked. Rohini Das, a super admin, finds the request on Members and opens his record, where Erasure on request completes it.
 * That the erasure closes the request and sends the one message is proved in supabase/tests/405_member_erasure_request.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Delete my account', () => {
  test('a member asks from Profile and a super admin finds the request on Members', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'leaves a request on the member, so the local stack only');
    test.setTimeout(90_000);
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000281', '/profile');
    await member.getByRole('button', { name: 'Delete my account' }).click();
    const sheet = member.getByRole('dialog', { name: 'Delete my account' });
    await expect(sheet.getByText(/within 7 days/)).toBeVisible();
    await sheet.getByRole('button', { name: 'Send request' }).click();
    await expect(member.getByText(/^Requested \d+ [A-Z][a-z]{2}$/)).toBeVisible();

    const staff = await browser.newPage();
    await signInToConsole(staff, '9000000152', '/members');
    await expect(staff.getByRole('heading', { name: 'Deletion requests' })).toBeVisible();
    await staff.getByRole('button', { name: /Kiran Joshi.*Asked/ }).click();
    await staff.getByRole('link', { name: 'Account', exact: true }).click();
    await expect(staff.getByRole('heading', { name: 'Erasure on request' })).toBeVisible();
  });
});
