/**
 * Call time (#78, #79; features "Call time"; additions flow 13; console v3, phase 2). Harish Kumar, this flow's own
 * floor manager (Auth sends one code a minute to a number), seats Ritika Das in the Private Room, where call time is three
 * hours (#634): her seat's row shows it, and Ritika's Tonight says where she sits, the game and how long she has played,
 * round the call-time ring (decision 0320). From her seat she asks for an hour more, which Harish approves in the
 * requests beside the floor, and for a top-up, which he starts and marks done there (decision 0446). He finds her playing on
 * Today's players (#641); she leaves her seat and, with call time owed, is a Leaving request. Then flow 13: she leaves
 * before her call time, so Harish, an admin, lets her go early with a reason, which frees the seat for the next run. The
 * clock across moves, away time, the completed event and the shortfall are proved in supabase/tests/051_call_time.test.sql,
 * the early departure in 057_call_time_at_cash_out.test.sql; the tablet's line is in the Seat events flow.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { requestsPanel, seatOnFloor, showSeats } from '../support/floor.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Ritika's request in the floor's panel that says `kind`: its own entry, once it has arrived. */
async function ritikasRequest(floor: Page, kind: RegExp) {
  const entry = requestsPanel(floor).locator('div').filter({ has: floor.getByRole('button', { name: 'Ritika Das', exact: true }) })
    .filter({ hasText: kind }).last();
  await expect(entry).toBeVisible({ timeout: 20_000 });
  return entry;
}

test.describe('Call time', () => {
  test('Tonight › Seated, Add time, Top-up requested, Leaving list: three hours, an hour more the floor approves, a top-up; leaving before it needs an admin', async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(isRemoteTarget(), 'seats a member and lets her go early, so the local stack only');
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000128');
    await seatOnFloor(floor, { table: 'Private Room', seat: 1, number: '9000000215' });
    await expect(floor.getByRole('button', { name: /^Seat 1, Ritika Das, (3 h|2 h 59 min)$/ })).toBeVisible();

    const player = await browser.newPage();
    await signInToPlayer(player, '9000000215');
    // Seated (decision 0320): where, the game and how long she has played, and the ring counting down to the server's end.
    await expect(player.getByRole('heading', { name: 'Private Room · Seat 1' })).toBeVisible();
    await expect(player.getByText(/ · playing /)).toBeVisible();
    await expect(player.getByRole('timer', { name: /^Call time left (3h 00m|2h 5\dm)$/ })).toBeVisible();

    // Add time is a request the floor approves (owner, 3 Nov): an hour, shown waiting, then approved in the requests.
    await player.getByRole('button', { name: 'Add time' }).click();
    await player.getByRole('dialog', { name: 'Add time' }).getByRole('button', { name: 'Request 1 hour' }).click();
    await expect(player.getByText('+1 h')).toBeVisible();
    await expect(player.getByRole('button', { name: 'Add time' })).toHaveAttribute('aria-disabled', 'true');
    await (await ritikasRequest(floor, /Wants \+1 h/)).getByRole('button', { name: 'Approve' }).click();
    await expect(floor.getByText('Ritika Das: +1 h approved')).toBeVisible();
    await showSeats(floor);
    await expect(floor.getByRole('button', { name: /^Seat 1, Ritika Das, (4 h|3 h 59 min)$/ })).toBeVisible();
    await player.reload();
    await expect(player.getByRole('timer', { name: /^Call time left (4h 00m|3h 5\dm)$/ })).toBeVisible();

    // A top-up the floor starts, then marks done (#634, decision 0299).
    await player.getByRole('button', { name: 'Top up' }).click();
    await player.getByRole('dialog', { name: 'Top up' }).getByRole('button', { name: 'Request top-up' }).click();
    await expect(player.getByText('Top-up', { exact: true })).toBeVisible();
    await expect(player.getByText('Requested', { exact: true })).toBeVisible();
    await (await ritikasRequest(floor, /^Top-up/)).getByRole('button', { name: 'Start' }).click();
    await expect(floor.getByText('Top-up started for Ritika Das')).toBeVisible();
    await player.reload();
    await expect(player.getByText('In progress', { exact: true })).toBeVisible();
    await (await ritikasRequest(floor, /Top-up in progress/)).getByRole('button', { name: 'Done' }).click();
    await expect(floor.getByText('Top-up done for Ritika Das')).toBeVisible();
    await player.reload();
    await expect(player.getByRole('button', { name: 'Top up' })).not.toHaveAttribute('aria-disabled', 'true');

    // Today's players (#641): she is playing, at the Private Room.
    await floor.goto(new URL('/door?tab=players', floor.url()).href);
    const today = floor.getByRole('row').filter({ hasText: 'Ritika Das' });
    await expect(today.getByText('Playing', { exact: true })).toBeVisible();
    await expect(today.getByText(/^Private Room · /)).toBeVisible();
    await floor.goto(new URL('/', floor.url()).href);

    // She leaves with call time owed: a Leaving request on the floor until it is done.
    await player.getByRole('button', { name: 'Leave seat' }).click();
    await player.getByRole('dialog', { name: 'Leave your seat?' }).getByRole('button', { name: 'Join leaving list' }).click();
    await expect(player.getByText('Leaving list', { exact: true })).toBeVisible();
    await expect(player.getByText('On the list', { exact: true })).toBeVisible();

    // Flow 13: she owes call time, so the admin lets her go early with one of four reasons (decision 0448), freeing the seat.
    await (await ritikasRequest(floor, /^Leaving/)).getByRole('button', { name: 'Leave', exact: true }).click();
    const leave = floor.getByRole('dialog', { name: 'Let go before call time' });
    await leave.getByRole('radio', { name: 'Emergency' }).click();
    await leave.getByRole('button', { name: 'Let go early' }).click();
    await expect(floor.getByText('Ritika Das let go early')).toBeVisible();
    await expect(floor.getByRole('button', { name: /^Seat 1, Ritika Das,/ })).toHaveCount(0, { timeout: 15_000 });
  });
});
