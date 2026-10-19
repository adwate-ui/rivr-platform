/**
 * Call time (#78; features "Call time"). Harish Kumar, this flow's own floor manager (Auth sends one
 * code a minute to a number), seats Ritika Das in the Private Room, where call time is two hours: the
 * live floor shows it beside her name, and Ritika's Home says where she sits and the time left. She
 * leaves at the end, so the next run finds the seat open. The clock across moves, away time, the
 * completed event and the shortfall are proved in supabase/tests/051_call_time.test.sql; the tablet's
 * line is in the Seat events flow.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Call time', () => {
  test('a player seated in the Private Room sees two hours of call time on Home, and the floor sees it too', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'seats a member, so the local stack only');
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

    await floor.getByRole('button', { name: 'Ritika Das leaves' }).click();
    await expect(floor.getByRole('button', { name: 'Move Ritika Das' })).toHaveCount(0);
  });
});
