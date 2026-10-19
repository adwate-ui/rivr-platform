/**
 * Seat events on the dealer tablet (#59; design prompt flow 3; the prototype's tablet seats). Tanvi
 * Joshi, this flow's own duty manager (Auth sends one code a minute to a number), seats Yash Gupta at
 * Table 3, seat 9, and pairs Table 3's tablet; Pema Lepcha signs in. On the tablet, seat 9 asks the
 * cage for the ₹10,000 minimum, and while it waits there no second request can be sent; the cage's
 * queue shows it with Yash's KYC photo. Yash is marked away and back, then leaves: seat 9 is open
 * again and his request leaves the cage's queue. The tablet is revoked at the end. Another table's
 * tablet, a revoked tablet and a frozen venue are refused in supabase/tests/050_seat_events.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, revoke, tabletAtTable3 } from '../support/tablet.ts';

test.describe('Seat events', () => {
  test('the tablet asks the cage for a buy-in, marks a player away and back, and lets him leave', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'seats a member, makes a device login and asks for chips, so the local stack only');
    test.setTimeout(90_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000127');
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 3', exact: true }).click();
    await floor.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '9', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Mobile number' }).fill('9000000214');
    await floor.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByRole('button', { name: 'Move Yash Gupta' })).toBeVisible();

    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    await tablet.getByRole('button', { name: 'Seat 9, Yash Gupta' }).click();
    await expect(tablet.getByRole('heading', { name: 'Seat 9 · Yash Gupta' })).toBeVisible();
    // An hour of call time at 100/200 (#78).
    await expect(tablet.getByText('Call time 1 h left')).toBeVisible();
    await tablet.getByRole('button', { name: 'Request buy-in' }).click();
    await expect(tablet.getByText('Buy-in ₹10,000 with the cage.')).toBeVisible();
    await expect(tablet.getByRole('button', { name: 'Request buy-in' })).toBeDisabled();

    await floor.getByRole('link', { name: 'Cage' }).click();
    await expect(floor.getByText(/^Buy-in · Table 3, seat 9 · \d{2}:\d{2}$/)).toBeVisible();
    await expect(floor.getByText('Yash Gupta', { exact: true })).toBeVisible();
    await expect(floor.getByRole('img', { name: 'KYC photo of Yash Gupta' }).or(floor.getByText(/^The photo could not load/))).toBeVisible();

    await tablet.getByRole('button', { name: 'Away', exact: true }).click();
    await expect(tablet.getByText('Away from the table. The seat is kept.')).toBeVisible();
    await expect(tablet.getByText(/^Call time paused, /)).toBeVisible();
    await tablet.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(tablet.getByText('Away from the table. The seat is kept.')).toHaveCount(0);
    await tablet.getByRole('button', { name: 'Player left' }).click();
    await expect(tablet.getByRole('button', { name: 'Seat 9, open' })).toBeVisible();
    await floor.reload();
    await expect(floor.getByText('No requests waiting.')).toBeVisible();
    await revoke(floor, name);
  });
});
