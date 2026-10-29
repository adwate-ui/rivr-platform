/**
 * Call time (#78, #79; features "Call time"; additions flow 13). Harish Kumar, this flow's own floor
 * manager (Auth sends one code a minute to a number), seats Ritika Das in the Private Room, where call
 * time is three hours (#634): the live floor shows it beside her name, and Ritika's Home says where she sits and
 * the time left, and how long she has played. From her seat (#634) she adds an hour of call time and asks for a top-up,
 * which Harish takes in hand and resets; she leaves her seat and, with call time owed, goes on the Leaving list. Then flow 13, with no cage on any console (#626): she leaves before her call time, so Harish, an
 * admin, lets her leave early with a reason and ends her seat, so the next run finds it open. The clock across moves,
 * away time, the completed event and the shortfall are proved in supabase/tests/051_call_time.test.sql,
 * the early departure in 057_call_time_at_cash_out.test.sql; the tablet's line is in the Seat events flow.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Call time', () => {
  test('a player seated in the Private Room sees three hours of call time, extends it, asks for a top-up; leaving before it needs an admin', async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(isRemoteTarget(), 'seats a member and cashes her out, so the local stack only');
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000128');
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();
    await floor.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '1', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Mobile number' }).fill('9000000215');
    await floor.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByRole('button', { name: 'Move Ritika Das' })).toBeVisible();
    await expect(floor.getByText(/^Call time (3 h|2 h 59 min) left$/)).toBeVisible();

    const player = await browser.newPage();
    await signInToPlayer(player, '9000000215');
    await expect(player.getByText('Seated at Private Room, seat 1.')).toBeVisible();
    await expect(player.getByText(/^Call time (3 h|2 h 59 min|2 h 58 min) left$/)).toBeVisible();
    await expect(player.getByText(/^Playing for /)).toBeVisible();

    // From her seat (#634): an hour more call time, and a top-up the floor takes in hand, then resets.
    await player.getByRole('button', { name: 'Add an hour of call time' }).click();
    await expect(player.getByText(/^Call time (4 h|3 h 59 min|3 h 58 min) left$/)).toBeVisible();
    await player.getByRole('button', { name: 'Ask for a top-up' }).click();
    await expect(player.getByText('Top-up requested. The floor is on its way.')).toBeVisible();
    await floor.getByRole('button', { name: 'The top-up for Ritika Das is in progress' }).click({ timeout: 20_000 });
    await expect(floor.getByText('Top-up in progress', { exact: true })).toBeVisible();
    await player.reload();
    await expect(player.getByText('Top-up in progress at your seat.')).toBeVisible();
    await floor.getByRole('button', { name: 'Reset the top-up for Ritika Das' }).click();
    await expect(floor.getByText('Top-up in progress', { exact: true })).toHaveCount(0);
    await player.reload();
    await expect(player.getByRole('button', { name: 'Ask for a top-up' })).toBeVisible();

    // She leaves with call time owed: she is on the floor's Leaving list until it is done.
    await player.getByRole('button', { name: 'Leave my seat' }).click();
    await expect(player.getByText('You are on the leaving list. The floor opens your seat once your call time is done.')).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Ritika Das is not leaving' }).first()).toBeVisible({ timeout: 20_000 });

    // Flow 13: an admin lets her leave early, with a reason, and ends her seat.
    await floor.getByRole('button', { name: 'Let Ritika Das leave early' }).click();
    await floor.getByRole('textbox', { name: 'Why they leave early' }).fill('Family emergency');
    await floor.getByRole('button', { name: 'Let leave early' }).click();
    await expect(floor.getByText('Early departure recorded. They can leave their seat.')).toBeVisible();
    await floor.getByRole('button', { name: 'Ritika Das leaves' }).click();
    await expect(floor.getByRole('button', { name: 'Move Ritika Das' })).toHaveCount(0, { timeout: 15_000 });
  });
});
