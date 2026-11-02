/**
 * Self-exclusion (#56; scope-v1 modules 1 and 12; the prototype's Profile). Mihir Shah, this flow's
 * own member (Auth sends one code a minute to a number), joins Table 1's list, sets a 4-hour session
 * reminder, then takes a 7-day break from Profile: the sheet says when each break would end; once
 * taken, Profile and Home say until when tables are closed, his place is gone, and Home offers no Join (decision 0300). A
 * break cannot be undone, so the flow runs on a freshly seeded local stack only.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToPlayer } from '../support/signIn.ts';

const UNTIL = /\w{3} \d{1,2} \w{3}, \d{2}:\d{2}/.source;
// A break in force names its end with the year, as the floor's may run for years.
const ENDS = /\d{1,2} \w{3} \d{4}, \d{2}:\d{2}/.source;

/** Table 1's Join on Home. */
function joinTable1(page: Page): Locator {
  return page.locator('div').filter({ has: page.getByText('Table 1', { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Join' }) }).last().getByRole('button', { name: 'Join' });
}

test.describe('Self-exclusion', () => {
  test('a member sets a session reminder and takes a break, and tables close to them', async ({ page }) => {
    test.skip(isRemoteTarget(), 'a break cannot be undone, so the local stack only');
    await signInToPlayer(page, '9000000213');
    await joinTable1(page).click();
    await expect(page.getByRole('heading', { name: 'Your waitlist' })).toBeVisible();

    await page.getByRole('link', { name: 'Profile' }).click();
    const fourHours = () => page.getByRole('group', { name: 'Session reminder' }).getByRole('button', { name: '4h' });
    await fourHours().click();
    await expect(fourHours()).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(fourHours()).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Take a break' }).click();
    const sheet = page.getByRole('dialog', { name: 'Take a break' });
    await expect(sheet.getByText('Tables and waitlists close to you. A break cannot be shortened.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: new RegExp(`^24 hours Until ${UNTIL}$`) })).toBeVisible();
    await sheet.getByRole('button', { name: /^7 days/ }).click();
    await expect(sheet).toHaveCount(0);
    // Asked once more, as it cannot be shortened (F3-15).
    await expect(page.getByText(new RegExp(`^Break until ${UNTIL}\\? It cannot be shortened\\.$`))).toBeVisible();
    await page.getByRole('button', { name: 'Yes, take the break' }).click();
    await expect(page.getByText(new RegExp(`^On a break until ${ENDS}\\.$`))).toBeVisible();
    // Take a break stays, to make the break longer: it is never shortened.
    await expect(page.getByRole('button', { name: 'Take a break' })).toBeVisible();

    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByText(/^On a break until /)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your waitlist' })).toHaveCount(0);
    // On a break, Home offers no Join, which the club would refuse anyway (decision 0300).
    await expect(page.getByText('Table 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Join / })).toHaveCount(0);
  });
});
