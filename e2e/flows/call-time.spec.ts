/**
 * Call time (#78, #79; features "Call time"; additions flow 13; console v3, phase 2). Harish Kumar, this flow's own
 * floor manager (Auth sends one code a minute to a number), seats Ritika Das in the Private Room with an hour and a half
 * of call time: her seat's row shows it, and Ritika's Tonight says where she sits, the game, how long she has played and
 * when she sat down, with no countdown (the owner, 17 Nov). From her seat she sets her call time (#1059, #1076): lengths
 * that would end before the hour and a half are greyed, and two hours from now are owed at once, on her screen and the
 * floor's row, which says when she leaves; the floor is told, and her button now extends it. She asks for a top-up, which he starts and marks done in the requests beside the floor (decision 0479). He finds her playing on
 * Today's players (#641); she leaves her seat and, with call time owed, is a Leaving request. Then flow 13: she leaves
 * before her call time, so Harish, an admin, lets her go early with a reason, which frees the seat for the next run. The
 * clock across moves, away time, the completed event and the shortfall are proved in supabase/tests/051_call_time.test.sql,
 * the early departure in 057_call_time_at_cash_out.test.sql; the tablet's line is in the Seat events flow.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { requestNamed, showSeats, tableTile } from '../support/floor.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** Ritika's request in the floor's panel that says `kind`: its own entry, once it has arrived. */
async function ritikasRequest(floor: Page, kind: RegExp) {
  const entry = requestNamed(floor, 'Ritika Das').filter({ hasText: kind }).last();
  await expect(entry).toBeVisible({ timeout: 20_000 });
  return entry;
}

test.describe('Call time', () => {
  test('Tonight › Seated, Set call time, Top-up requested, Leaving list: an hour and a half, two hours she sets, a top-up; leaving before it needs an admin', async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(isRemoteTarget(), 'seats a member and lets her go early, so the local stack only');
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000128');
    // Seated with an hour and a half typed over the Private Room's own, so the club's lengths fall either side of it.
    await showSeats(floor);
    await tableTile(floor, 'Private Room').getByRole('button', { name: 'Seat 1, Open' }).click();
    const seating = floor.getByRole('dialog', { name: 'Seat a player' });
    await seating.getByRole('textbox', { name: /^(Or a n|N)ame, mobile or member number$/ }).fill('9000000215');
    await seating.getByLabel('Call time', { exact: true }).fill('90');
    await seating.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByRole('button', { name: /^Seat 1, Ritika Das, (1 h 30 min|1 h 29 min)$/ })).toBeVisible();

    const player = await browser.newPage();
    await signInToPlayer(player, '9000000215');
    // Seated (the owner, 17 Nov): where, the game and how long she has played, and when she sat down, with no countdown.
    await expect(player.getByRole('heading', { name: 'Private Room, seat 1' })).toBeVisible();
    await expect(player.getByText(/ · playing /)).toBeVisible();
    await expect(player.getByText('Playing since')).toBeVisible();
    await expect(player.getByRole('timer')).toHaveCount(0);

    // Set call time (#1059): 30 minutes and an hour would end before the hour and a half she owes; two hours from now are
    // owed at once, with no request to the floor, and her seat's row says so.
    await player.getByRole('button', { name: 'Set call time' }).click();
    const setting = player.getByRole('dialog', { name: 'Set call time' });
    await expect(setting.getByRole('radio', { name: '30 min' })).toBeDisabled();
    await expect(setting.getByRole('radio', { name: '1 h' })).toBeDisabled();
    await expect(setting.getByRole('radio', { name: '2 h' })).toHaveAttribute('aria-checked', 'true');
    await expect(setting.getByText(/^Can't end before \d\d:\d\d\.$/)).toBeVisible();
    await setting.getByRole('button', { name: 'Set call time' }).click();
    await expect(player.getByText(/^Call time until \d\d:\d\d$/).first()).toBeVisible();
    await expect(player.getByRole('button', { name: 'Extend call time' })).toBeVisible();
    // The floor is told on whatever screen it is (#1076), and her row says when she leaves.
    await expect(floor.getByText(/^Ritika Das set call time · leaves \d\d:\d\d$/)).toBeVisible({ timeout: 20_000 });
    await showSeats(floor);
    await expect(floor.getByRole('button', { name: /^Seat 1, Ritika Das, Leaves \d\d:\d\d$/ })).toBeVisible();
    // And it waits in Requests until the floor marks it seen (#1090, the owner, 19 Nov).
    await (await ritikasRequest(floor, /^Call time set/)).getByRole('button', { name: 'Seen' }).click();
    await expect(floor.getByText('Ritika Das: call time seen')).toBeVisible();

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

    // Today's players (#641), the Door's second tab (console v3): she is playing, at the Private Room.
    await floor.getByRole('link', { name: 'Door', exact: true }).click();
    await floor.getByRole('navigation', { name: 'Door', exact: true }).getByRole('link', { name: 'Today’s players' }).click();
    const today = floor.getByRole('row').filter({ hasText: 'Ritika Das' });
    await expect(today.getByText('Playing', { exact: true })).toBeVisible();
    await expect(today.getByText('Private Room', { exact: true })).toBeVisible();
    await floor.getByRole('link', { name: 'Live floor', exact: true }).click();

    // She leaves with call time owed: a Leaving request on the floor until it is done.
    await player.getByRole('button', { name: 'Leave seat' }).click();
    await player.getByRole('dialog', { name: 'Leave your seat?' }).getByRole('button', { name: 'Join leaving list' }).click();
    await expect(player.getByText('Leaving list', { exact: true })).toBeVisible();
    await expect(player.getByText('On the list', { exact: true })).toBeVisible();

    // Flow 13: she owes call time, so the admin lets her go early with one of four reasons (decision 0481), freeing the seat.
    await (await ritikasRequest(floor, /^Leaving/)).getByRole('button', { name: 'Leave', exact: true }).click();
    const leave = floor.getByRole('dialog', { name: 'Let go before call time' });
    await leave.getByRole('radio', { name: 'Emergency' }).click();
    await leave.getByRole('button', { name: 'Let go early', exact: true }).click();
    await expect(floor.getByText('Ritika Das let go early')).toBeVisible();
    await expect(floor.getByRole('button', { name: /^Seat 1, Ritika Das,/ })).toHaveCount(0, { timeout: 15_000 });
  });
});
