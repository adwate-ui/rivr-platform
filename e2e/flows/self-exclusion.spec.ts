/**
 * Self-exclusion (#56; decisions 0300 and 0322). The redesigned app no longer takes a break or sets a session reminder: the
 * club does, from the member's record, and the server still enforces it. Mihir Shah, this flow's own member (Auth sends
 * one code a minute to a number), joins at Table 1; Meher Gill, an admin no other flow signs in as, puts him on a 7-day
 * break with a reason, asked twice. His place is gone, Tonight says until when, and a table offers no join. A break cannot
 * be undone, so the flow runs on a freshly seeded local stack only.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

// A break in force names its end with the year, as the floor's may run for years.
const ENDS = /\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/.source;
const JOIN = /^(Take a seat|Join waitlist)$/;

test.describe('Self-exclusion', () => {
  test('Tonight › Browsing: a member the club puts on a break loses his place, is told until when, and cannot join', async ({ browser, page }) => {
    test.skip(isRemoteTarget(), 'a break cannot be undone, so the local stack only');
    test.setTimeout(90_000);
    await signInToPlayer(page, '9000000213');
    await page.getByRole('button', { name: /^Table 1 · / }).click();
    await page.getByRole('dialog').getByRole('button', { name: JOIN }).click();
    await expect(page.getByRole('button', { name: 'Leave waitlist' })).toBeVisible();

    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000193');
    await admin.getByRole('link', { name: 'Members' }).click();
    await admin.getByRole('searchbox', { name: 'Name, member no. or mobile' }).fill('9000000213');
    await admin.getByRole('button', { name: 'Mihir Shah', exact: true }).click();
    await admin.getByRole('link', { name: 'Tier and break' }).click();
    await admin.getByRole('radiogroup', { name: 'How long' }).getByRole('radio', { name: '7 days' }).click();
    await admin.getByRole('textbox', { name: 'Why the break' }).fill('Asked for a week off');
    await admin.getByRole('button', { name: 'Start break' }).click();
    await admin.getByRole('button', { name: 'Yes, start a break of 7 days' }).click();
    await expect(admin.getByText(new RegExp(`^On a break until ${ENDS}\\.$`))).toBeVisible();

    // His place is gone, and Tonight says until when; a table offers no join, which the club would refuse anyway.
    await page.reload();
    await expect(page.getByText(new RegExp(`^On a break until ${ENDS}\\.$`))).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave waitlist' })).toHaveCount(0);
    await page.getByRole('button', { name: /^Table 1 · / }).click();
    await expect(page.getByRole('dialog').getByText(/^On a break until /)).toBeVisible();
    await expect(page.getByRole('button', { name: JOIN })).toHaveCount(0);
  });
});
