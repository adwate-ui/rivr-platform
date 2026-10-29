/**
 * Seat events on the dealer tablet (#59; design prompt flow 3; the prototype's tablet seats). Tanvi
 * Joshi, this flow's own duty manager (Auth sends one code a minute to a number), seats Yash Gupta at
 * Table 3, seat 9, and pairs Table 3's tablet; Pema Lepcha signs in. The tablet shows his call time and no buy-in
 * in rupees (#630). Yash is marked away and back, then leaves: seat 9 is open again. The tablet is revoked at the end. Another table's
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
    // No buy-in in rupees on the tablet (#630).
    await expect(tablet.getByRole('button', { name: 'Request buy-in' })).toHaveCount(0);

    await tablet.getByRole('button', { name: 'Away', exact: true }).click();
    await expect(tablet.getByText('Away from the table. The seat is kept.')).toBeVisible();
    await expect(tablet.getByText(/^Call time paused, /)).toBeVisible();
    await tablet.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(tablet.getByText('Away from the table. The seat is kept.')).toHaveCount(0);
    await tablet.getByRole('button', { name: 'Player left' }).click();
    await expect(tablet.getByRole('button', { name: 'Seat 9, open' })).toBeVisible();
    await revoke(floor, name);
  });
});
