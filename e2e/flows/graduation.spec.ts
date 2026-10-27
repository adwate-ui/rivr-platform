/**
 * Graduation (#128; scope-v1 modules 9 and 15). Ritu Malhotra, this flow's own student, is booked on a batch running
 * this week with her UTR given (seed 75_academy_graduation.sql). Anika Rao, this flow’s own super admin, marks her present at
 * today's class; Omar Siddiqui, its own cashier, confirms her UTR in the bank; and Anika graduates her: she is on the Academy graduate tier, and the graduation trigger runs the
 * promotions, so the graduate freeroll arrives with no manual step once it runs (proved in
 * supabase/tests/174_academy_graduation.test.sql).
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Graduation', () => {
  test('Graduation: staff mark a student present and, once paid, graduate her to the Academy graduate tier', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'graduates a seeded student, so the local stack only');
    // Anika Rao, this flow's own super admin: Auth sends one code a minute to a number, so no other flow signs in as her.
    await signInToConsole(page, '9000000624');
    await page.getByRole('link', { name: 'Academy', exact: true }).click();
    const student = page.getByText('Ritu Malhotra', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Graduate"]][1]');
    await expect(page.getByText('Ritu Malhotra', { exact: true })).toBeVisible();
    await student.getByRole('button', { name: 'Present today' }).click();
    await expect(student.getByText('Present at 1 class.')).toBeVisible();

    // She graduates once the cage has confirmed her payment.
    const cashier = await browser.newPage();
    await signInToConsole(cashier, '9000000625');
    await cashier.getByRole('link', { name: 'Academy payments' }).click();
    const payment = cashier.locator('div').filter({ hasText: 'UTR 600000000622' })
      .filter({ has: cashier.getByRole('button', { name: 'Found in the bank' }) }).last();
    await payment.getByRole('button', { name: 'Found in the bank' }).click();
    await expect(cashier.getByText('UTR 600000000622')).toHaveCount(0);

    await page.reload();
    await student.getByRole('button', { name: 'Graduate' }).click();
    await expect(page.getByText('Graduated: on the Academy graduate tier.')).toBeVisible();
  });
});
