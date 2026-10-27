/**
 * Graduation (#128; scope-v1 modules 9 and 15). Ritu Malhotra, this flow's own student, is booked on a batch running
 * this week with her UTR given (seed 75_academy_graduation.sql). Meera Iyer, who manages members, marks her present at
 * today's class; Manoj Pillai, a cashier, confirms her UTR in the bank; and Meera graduates her: she is on the Academy graduate tier, and the graduation trigger runs the
 * promotions, so the graduate freeroll arrives with no manual step once it runs (proved in
 * supabase/tests/174_academy_graduation.test.sql).
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Graduation', () => {
  test('Graduation: staff mark a student present and, once paid, graduate her to the Academy graduate tier', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'graduates a seeded student, so the local stack only');
    // Meera Iyer (super admin) by her own number, not the F&B flow's: Auth sends one code a minute to a number.
    await signInToConsole(page, '9000000102');
    await page.getByRole('link', { name: 'Academy', exact: true }).click();
    const student = page.getByText('Ritu Malhotra', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Graduate"]][1]');
    await expect(page.getByText('Ritu Malhotra', { exact: true })).toBeVisible();
    await student.getByRole('button', { name: 'Present today' }).click();
    await expect(student.getByText('Present at 1 class.')).toBeVisible();

    // She graduates once the cage has confirmed her payment.
    const cashier = await browser.newPage();
    await signInToConsole(cashier, '9000000151');
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
