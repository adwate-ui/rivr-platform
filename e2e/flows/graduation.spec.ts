/**
 * Graduation (#128; scope-v1 modules 9 and 15). Ritu Malhotra, this flow's own student, is booked on a batch running
 * this week with her UTR given (seed 75_academy_graduation.sql). Rahul Mehta, staff who manage members, marks her
 * present at today's class and graduates her: she is on the Academy graduate tier, and the graduation trigger runs the
 * promotions, so the graduate freeroll arrives with no manual step once it runs (proved in
 * supabase/tests/174_academy_graduation.test.sql).
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Graduation', () => {
  test('Graduation: staff mark a student present and graduate her to the Academy graduate tier', async ({ page }) => {
    test.skip(isRemoteTarget(), 'graduates a seeded student, so the local stack only');
    await signInToConsole(page, '9000000615');
    await page.getByRole('link', { name: 'Academy', exact: true }).click();
    const student = page.getByText('Ritu Malhotra', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space()="Graduate"]][1]');
    await expect(page.getByText('Ritu Malhotra', { exact: true })).toBeVisible();
    await student.getByRole('button', { name: 'Present today' }).click();
    await expect(student.getByText('Present at 1 class.')).toBeVisible();
    await student.getByRole('button', { name: 'Graduate' }).click();
    await expect(page.getByText('Graduated: on the Academy graduate tier.')).toBeVisible();
  });
});
