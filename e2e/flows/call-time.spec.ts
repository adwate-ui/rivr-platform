/**
 * Call time (#78, #79; features "Call time"; additions flow 13). Harish Kumar, this flow's own floor
 * manager (Auth sends one code a minute to a number), seats Ritika Das in the Private Room, where call
 * time is three hours (#634): the live floor shows it beside her name, and Ritika's Tonight says where she sits, the game
 * and how long she has played, round the call-time ring (decision 0320). From her seat she asks for an hour more, which
 * Harish approves beside her seat, and asks for a top-up, which he takes in hand and resets, and sees fulfilled among tonight's (#639); he changes her call time to five hours (#638)
 * and finds her playing on Today's players (#641); she leaves her seat and, with call time owed, goes on the Leaving list. Then flow 13, with no cage on any console (#626): she leaves before her call time, so Harish, an
 * admin, lets her leave early with a reason and ends her seat, so the next run finds it open. The clock across moves,
 * away time, the completed event and the shortfall are proved in supabase/tests/051_call_time.test.sql,
 * the early departure in 057_call_time_at_cash_out.test.sql; the tablet's line is in the Seat events flow.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Call time', () => {
  test('Tonight › Seated, Add time, Top-up requested, Leaving list: three hours, an hour more the floor approves, a top-up; leaving before it needs an admin', async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(isRemoteTarget(), 'seats a member and cashes her out, so the local stack only');
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000128');
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();
    await floor.getByRole('radiogroup', { name: 'Seat', exact: true }).getByRole('radio', { name: '1', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Mobile or member number' }).fill('9000000215');
    await floor.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByRole('button', { name: 'Ritika Das leaves' })).toBeVisible();
    await expect(floor.getByText(/^Call time (3 h|2 h 59 min) left$/)).toBeVisible();

    const player = await browser.newPage();
    await signInToPlayer(player, '9000000215');
    // Seated (decision 0320): where, the game and how long she has played, and the ring counting down to the server's end.
    await expect(player.getByRole('heading', { name: 'Private Room · Seat 1' })).toBeVisible();
    await expect(player.getByText(/ · playing /)).toBeVisible();
    await expect(player.getByRole('timer', { name: /^Call time left (3h 00m|2h 5\dm)$/ })).toBeVisible();

    // Add time is a request the floor approves (owner, 3 Nov): an hour, shown waiting, then approved beside her seat.
    await player.getByRole('button', { name: 'Add time' }).click();
    await player.getByRole('dialog', { name: 'Add time' }).getByRole('button', { name: 'Request 1 hour' }).click();
    await expect(player.getByText('+1 h')).toBeVisible();
    await expect(player.getByRole('button', { name: 'Add time' })).toHaveAttribute('aria-disabled', 'true');
    await expect(floor.getByText('+1 h asked')).toBeVisible({ timeout: 20_000 });
    await floor.getByRole('button', { name: 'Approve more call time for Ritika Das' }).click();
    await expect(floor.getByText(/^Call time (4 h|3 h 59 min) left$/)).toBeVisible();
    await player.reload();
    await expect(player.getByRole('timer', { name: /^Call time left (4h 00m|3h 5\dm)$/ })).toBeVisible();

    // A top-up the floor takes in hand, then resets (#634).
    await player.getByRole('button', { name: 'Top up' }).click();
    await player.getByRole('dialog', { name: 'Top up' }).getByRole('button', { name: 'Request top-up' }).click();
    await expect(player.getByText('Top-up', { exact: true })).toBeVisible();
    await expect(player.getByText('Requested', { exact: true })).toBeVisible();
    // The floor sees it on Top-ups, counted in red on the rail and marked on the room plan (decision 0299).
    await expect(floor.getByRole('region', { name: 'Room plan' }).getByText('Top-up', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(floor.getByRole('link', { name: 'Top-ups', exact: true })).toHaveAccessibleDescription(/^\d+ waiting$/, { timeout: 20_000 });
    await floor.getByRole('link', { name: 'Top-ups', exact: true }).click();
    await expect(floor.getByText('Table 1, seat 1 · Ritika Das').or(floor.getByText(/· Ritika Das$/)).first()).toBeVisible();
    await floor.getByRole('button', { name: 'The top-up for Ritika Das is in progress' }).click();
    await expect(floor.getByRole('button', { name: 'The top-up for Ritika Das is done' })).toBeVisible();
    await player.reload();
    await expect(player.getByText('In progress', { exact: true })).toBeVisible();
    await floor.getByRole('button', { name: 'The top-up for Ritika Das is done' }).click();
    // Tonight's top-ups (#639): fulfilled, with the time it took.
    await expect(floor.getByText(/^Fulfilled in /).first()).toBeVisible({ timeout: 20_000 });
    await player.reload();
    await expect(player.getByRole('button', { name: 'Top up' })).not.toHaveAttribute('aria-disabled', 'true');
    await floor.getByRole('link', { name: 'Live floor', exact: true }).click();
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();
    // The floor changes her call time (#638): five hours from when she sat down.
    await floor.getByRole('button', { name: 'Change the call time of Ritika Das' }).click();
    await floor.getByRole('textbox', { name: 'Call time in minutes, from when they sat down' }).fill('300');
    await floor.getByRole('button', { name: 'Save call time' }).click();
    await expect(floor.getByText(/^Call time (5 h|4 h 59 min) left$/)).toBeVisible();
    // Today's players (#641): she is playing, at the Private Room.
    await floor.getByRole('link', { name: 'Today’s players' }).click();
    const today = floor.getByRole('row').filter({ hasText: 'Ritika Das' });
    await expect(today.getByText('Playing', { exact: true })).toBeVisible();
    await expect(today.getByText(/^Private Room · /)).toBeVisible();
    await floor.getByRole('link', { name: 'Live floor' }).click();
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Private Room', exact: true }).click();

    // She leaves with call time owed: she is on the floor's Leaving list until it is done.
    await player.getByRole('button', { name: 'Leave seat' }).click();
    await player.getByRole('dialog', { name: 'Leave your seat?' }).getByRole('button', { name: 'Join leaving list' }).click();
    await expect(player.getByText('Leaving list', { exact: true })).toBeVisible();
    await expect(player.getByText('On the list', { exact: true })).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Ritika Das is not leaving' }).first()).toBeVisible({ timeout: 20_000 });

    // Flow 13: one Leave (decision 0299). She owes call time, so the admin lets her go early with a reason, and the seat is freed.
    await floor.getByRole('button', { name: 'Ritika Das leaves' }).click();
    await floor.getByRole('textbox', { name: 'Why they leave early' }).fill('Family emergency');
    await floor.getByRole('button', { name: 'Let leave early' }).click();
    await expect(floor.getByText('Released early.')).toBeVisible();
    await expect(floor.getByRole('button', { name: 'Ritika Das leaves' })).toHaveCount(0, { timeout: 15_000 });
  });
});
