/**
 * Rate your visit (#160; decisions 0165 and 0320). Nisha Arora, this flow's own floor manager (an admin, 14_people_c.sql:
 * Auth sends one code a minute to a number), checks Vidya Chadha in at the Door by her number and out from the room
 * list. Vidya, whom no other flow signs in as, is then asked on Home how her night was; she gives it a 2 with a note,
 * and a toast says it went to the General Manager. Nisha sees the ticket on Feedback and resolves it with what was
 * done. In and out with no time played, the visit earns nothing.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Rate your visit', () => {
  test('Rate your visit: a member checked out at the door rates her night, and the General Manager resolves it', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'opens and closes a visit and sends feedback, so the local stack only');
    test.setTimeout(90_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000191');
    await floor.getByRole('link', { name: 'Door', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Name, mobile or member number' }).fill('9000000401');
    await floor.getByRole('button', { name: 'Check in', exact: true }).click();
    await floor.getByRole('button', { name: 'Check out Vidya Chadha' }).click();
    await expect(floor.getByRole('button', { name: 'Check out Vidya Chadha' })).toHaveCount(0);

    // Home › Rate your visit, on opening the app after the visit: a 2 with a note is a ticket for the General Manager.
    const member = await (await browser.newContext()).newPage();
    await signInToPlayer(member, '9000000401');
    await expect(member.getByRole('heading', { name: 'How was your night?' })).toBeVisible();
    await member.getByRole('radiogroup', { name: 'Your rating, 1 to 5' }).getByRole('radio', { name: '2', exact: true }).click();
    await member.getByRole('textbox', { name: 'Anything to add? (optional)' }).fill('The door queue was slow.');
    await member.getByRole('button', { name: 'Send to the General Manager' }).click();
    await expect(member.getByText('Rating sent')).toBeVisible();
    await expect(member.getByRole('heading', { name: 'How was your night?' })).toHaveCount(0);

    await floor.getByRole('link', { name: 'Feedback' }).click();
    await expect(floor.getByText('The door queue was slow.')).toBeVisible();
    await floor.getByRole('row').filter({ hasText: 'The door queue was slow.' }).getByRole('checkbox').check();
    await floor.getByRole('button', { name: 'Resolve', exact: true }).click();
    await floor.getByRole('textbox', { name: 'What was done' }).fill('Second host on the door from Friday.');
    await floor.getByRole('button', { name: 'Resolve 1', exact: true }).click();
    // A resolved ticket leaves Open for Resolved, kept with the name of who resolved it (console v3).
    await floor.getByRole('link', { name: /^Resolved \d+$/ }).click();
    await expect(floor.getByText(/^Resolved by Nisha Arora on .*: Second host on the door from Friday\.$/)).toBeVisible();
  });
});
