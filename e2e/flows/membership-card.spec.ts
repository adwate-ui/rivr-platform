/**
 * Membership card (#71; tech plan item 28; decision 0162). Kavya Rao opens her card from Profile: her name,
 * tier and number, and a QR that changes every 30 seconds. The front desk, Farhan Ali, enters what the
 * door's scanner reads: a code from before her QR changed, as a screenshot would hold, is refused, and the
 * one on her screen checks her in. Both are this flow's own people (supabase/seed/14_people_c.sql). She
 * stays in the room until check-out (#82) comes, so the flow runs on a freshly seeded local stack.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** What the QR on the member's card holds now. */
async function doorCode(page: Page): Promise<string> {
  return (await page.getByRole('img', { name: 'Your door code' }).getAttribute('data-value')) ?? '';
}

/** One of the door's lists, found by its heading. */
function doorList(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByRole('heading', { name, level: 2 }) }).last();
}

test.describe('Membership card', () => {
  test('the door checks a member in by the QR on her card, and refuses a code from before it changed', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'opens a visit that only check-out (#82) closes, so the local stack only');
    // The QR changes every 30 seconds, and the flow waits for one change.
    test.setTimeout(150_000);
    const member = await (await browser.newContext()).newPage();
    await signInToPlayer(member, '9000000290');
    await member.getByRole('link', { name: 'Profile' }).click();
    await member.getByRole('button', { name: 'Show card' }).click();
    await expect(member.getByRole('article', { name: 'Membership card' })).toBeVisible();
    await expect(member.getByText('Kavya Rao')).toBeVisible();
    await expect(member.getByRole('img', { name: 'Your door code' })).toBeVisible();
    const screenshot = await doorCode(member);
    await expect.poll(() => doorCode(member), { timeout: 40_000 }).not.toBe(screenshot);

    const desk = await (await browser.newContext()).newPage();
    await signInToConsole(desk, '9000000190');
    await desk.getByRole('link', { name: 'Check-in' }).click();
    const card = desk.getByRole('textbox', { name: 'Membership card' });
    // Past the few seconds' grace a code has once its QR has changed.
    await expect(desk.getByRole('heading', { name: 'Check-in', level: 1 })).toBeVisible();
    await desk.waitForTimeout(6_000);
    await card.fill(screenshot);
    await card.press('Enter');
    await expect(desk.getByText('That card code has changed. Ask the member to show their card again.')).toBeVisible();
    await expect(doorList(desk, 'In the room').getByText('Kavya Rao')).toHaveCount(0);

    await card.fill(await doorCode(member));
    await desk.getByRole('button', { name: 'Check in by card' }).click();
    await expect(doorList(desk, 'In the room').getByText('Kavya Rao')).toBeVisible();
  });
});
