/**
 * Call time (#78, #79; features "Call time"; additions flow 13). Harish Kumar, this flow's own floor
 * manager (Auth sends one code a minute to a number), seats Ritika Das in the Private Room, where call
 * time is two hours: the live floor shows it beside her name, and Ritika's Home says where she sits and
 * the time left. Then flow 13: she cashes out before her call time. The cashier, Dev Arora (105), sees the
 * shortfall and the cash-out is refused; Harish, an admin, lets her leave early with a reason; the final
 * cash-out then goes through and ends her seat, so the next run finds it open. The clock across moves,
 * away time, the completed event and the shortfall are proved in supabase/tests/051_call_time.test.sql,
 * the early departure in 057_call_time_at_cash_out.test.sql; the tablet's line is in the Seat events flow.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Call time', () => {
  test('a player seated in the Private Room sees two hours of call time; cashing out before it needs an admin to let her go', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'seats a member and cashes her out, so the local stack only');
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000128');
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();
    await floor.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '1', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Mobile number' }).fill('9000000215');
    await floor.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByRole('button', { name: 'Move Ritika Das' })).toBeVisible();
    await expect(floor.getByText('Call time 2 h left')).toBeVisible();

    const player = await browser.newPage();
    await signInToPlayer(player, '9000000215');
    await expect(player.getByText('Seated at Private Room, seat 1.')).toBeVisible();
    await expect(player.getByText('Call time 2 h left')).toBeVisible();

    // Flow 13: the cashier sees the shortfall, and the cash-out is refused.
    const cage = await browser.newPage();
    await signInToConsole(cage, '9000000105');
    await cage.getByRole('link', { name: 'Cage' }).click();
    await cage.getByRole('textbox', { name: 'Search members' }).fill('Ritika');
    await cage.getByRole('button', { name: 'Ritika Das' }).click();
    await expect(cage.getByText(/^Call time not complete: (2 h|1 h 59 min) short\./)).toBeVisible();
    await cage.getByRole('textbox', { name: 'Chips handed back' }).fill('1000');
    await cage.getByRole('switch', { name: 'Final cash-out' }).click();
    await cage.getByRole('button', { name: 'Cash out' }).click();
    await expect(cage.getByText('Call time is not complete. An admin lets them leave early, with a reason, on the Live floor.')).toBeVisible();

    // An admin lets her leave early, with a reason; the same cash-out then goes through and she leaves.
    await floor.getByRole('button', { name: 'Let Ritika Das leave early' }).click();
    await floor.getByRole('textbox', { name: 'Why they leave early' }).fill('Family emergency');
    await floor.getByRole('button', { name: 'Let leave early' }).click();
    await expect(floor.getByText('Early departure recorded. The cage can cash them out.')).toBeVisible();
    await cage.getByRole('button', { name: 'Cash out' }).click();
    await expect(cage.getByText('Cash-out done. Hand over ₹1,000 in cash.')).toBeVisible();
    await expect(cage.getByText('Visit closed.')).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Move Ritika Das' })).toHaveCount(0, { timeout: 15_000 });
  });
});
