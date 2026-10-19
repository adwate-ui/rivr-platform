/**
 * Credit lines (#73; scope-v1 module 5; additions flow 19 begins here). Aditya Malhotra, a floor
 * manager, gives Kunal Mehra (three visits, identity check finished) ₹50,000 of credit, in force at
 * once; he asks for ₹2,00,000, above the ₹1,00,000 threshold, and it waits. Devika Sharma, this flow's
 * own super admin, approves it. Ishaan Verma has never visited: no credit. At the end Kunal's line is
 * closed, so the next run starts afresh. Markers against the limit are #74's.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

async function setLimit(page: import('@playwright/test').Page, phone: string, rupees: string, reason: string) {
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(phone);
  await page.getByRole('textbox', { name: 'Limit' }).fill(rupees);
  await page.getByRole('textbox', { name: 'Why' }).fill(reason);
  await page.getByRole('button', { name: 'Set limit' }).click();
}

test.describe('Credit', () => {
  test('a floor manager gives credit within the threshold; above it a super admin approves', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'sets credit limits, so the local stack only');
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000103');
    await floor.getByRole('link', { name: 'Markers' }).click();
    await expect(floor.getByRole('heading', { name: 'Markers', level: 1 })).toBeVisible();
    await expect(floor.getByText('Room exposure')).toBeVisible();

    await setLimit(floor, '9000000216', '50000', 'A regular');
    await expect(floor.getByText('Limit in force.')).toBeVisible();
    await expect(floor.getByText('Limit ₹50,000 · ₹0 outstanding')).toBeVisible();
    await setLimit(floor, '9000000216', '200000', 'Plays 100/200 weekly');
    await expect(floor.getByText('Above the threshold: the limit waits for a super admin.')).toBeVisible();
    await expect(floor.getByText('₹2,00,000 waiting for approval · Aditya Malhotra: Plays 100/200 weekly')).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Approve the limit for Kunal Mehra' })).toHaveCount(0);
    await setLimit(floor, '9000000211', '50000', 'New');
    await expect(floor.getByText('This member has not visited often enough for credit yet.')).toBeVisible();

    const owner = await browser.newPage();
    await signInToConsole(owner, '9000000130');
    await owner.getByRole('link', { name: 'Markers' }).click();
    await owner.getByRole('button', { name: 'Approve the limit for Kunal Mehra' }).click();
    await expect(owner.getByText('Limit ₹2,00,000 · ₹0 outstanding')).toBeVisible();
    await expect(owner.getByText(/waiting for approval/)).toHaveCount(0);

    await setLimit(owner, '9000000216', '0', 'End of the test run');
    // Kunal's line closes; Arjun Mehta's (seed) stays.
    await expect(owner.getByText('Kunal Mehra', { exact: true })).toHaveCount(0);
    await expect(owner.getByText('Arjun Mehta', { exact: true }).first()).toBeVisible();
  });
});
