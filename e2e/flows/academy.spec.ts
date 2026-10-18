/**
 * Academy booking (#8): a member opens RIVR Academy from Learn, books a seat in a batch at ₹2,000,
 * sees the club's UPI ID and gives the UTR of the payment. Dev Malhotra is this flow's own member: Auth
 * sends one code a minute to a number, so no other flow signs in as him. A later run finds the seat
 * already booked and corrects the UTR instead.
 */
import { expect, test } from '@playwright/test';
import { signInToPlayer } from '../support/signIn.ts';

test.describe('Academy booking', () => {
  test('a member books a seat in a batch and gives the UTR of the UPI payment', async ({ page }) => {
    await signInToPlayer(page, '9000000210');
    await page.getByRole('link', { name: 'Learn' }).click();
    await page.getByRole('button', { name: 'See batches' }).click();
    await expect(page.getByRole('heading', { name: 'RIVR Academy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible();

    const book = page.getByRole('button', { name: 'Book a seat' });
    const again = page.getByRole('button', { name: /^(Pay|Change the UTR)$/ });
    await expect(book.or(again)).toBeVisible();
    await ((await book.isVisible()) ? book : again).click();

    await expect(page.getByRole('heading', { name: 'Pay for your seat' })).toBeVisible();
    await expect(page.getByText('₹2,000')).toBeVisible();
    await expect(page.getByText('rivr.gurugram@icici')).toBeVisible();
    const utr = page.getByRole('textbox', { name: 'UTR' });
    await utr.fill('12');
    await page.getByRole('button', { name: 'Send UTR' }).click();
    await expect(page.getByText('Enter the 12-digit UTR from your payment.')).toBeVisible();
    // A UTR no other run has used.
    const given = String(Date.now()).slice(-12).padStart(12, '7');
    await utr.fill(given);
    await page.getByRole('button', { name: 'Send UTR' }).click();
    await expect(page.getByText(`Payment sent with UTR ${given}.`, { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Your bookings' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change the UTR' })).toBeVisible();
  });
});
