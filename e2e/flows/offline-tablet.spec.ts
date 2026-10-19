/**
 * Offline tablet (#43; additions "Offline behaviour"): the dealer tablet keeps logging hands with no
 * connection and sends them once it is back. Signed in on the console as its own duty manager
 * (Auth sends one code a minute to a number), the flow pairs a tablet at Table 3 and Pema Lepcha
 * signs in. Offline, two hands are logged: the banner says "Offline. 2 hands queued." and both show
 * as queued; back online, the tablet says "2 queued hands sent to the floor." and both arrive, once
 * each, in the order they were played. The tablet is revoked at the end.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

test.describe('Offline tablet', () => {
  test('hands keep logging offline and arrive in order, once each, when the connection is back', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and logs hands, so the local stack only');
    test.setTimeout(90_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000122');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);

    await tablet.context().setOffline(true);
    await expect(tablet.getByText('Offline. 0 hands queued.')).toBeVisible();
    await press(tablet, ['4', '8', '000', 'Log hand']);
    await expect(tablet.getByText('Offline. 1 hand queued.')).toBeVisible();
    await tablet.getByRole('button', { name: 'PLO', exact: true }).click();
    await press(tablet, ['5', '0', '0', 'Log hand']);
    await expect(tablet.getByText('Offline. 2 hands queued.')).toBeVisible();
    // As in the prototype, the hands count at once and show as queued.
    await expect(tablet.getByText('Hands this down: 2')).toBeVisible();
    await expect(tablet.getByText(/ · queued$/)).toHaveText([/PLO · queued$/, /Hold'em · queued$/]);
    // End of down waits for them: the down's count must include every hand.
    await tablet.getByRole('button', { name: 'End of down', exact: true }).click();
    await expect(tablet.getByText('Reconnect to send 2 queued hands before hand-over.')).toBeVisible();
    await expect(tablet.getByRole('button', { name: 'Close the down' })).toBeDisabled();
    await tablet.getByRole('button', { name: 'Cancel' }).click();

    await tablet.context().setOffline(false);
    await expect(tablet.getByText('2 queued hands sent to the floor.')).toBeVisible({ timeout: 15_000 });
    await expect(tablet.getByText('Hands this down: 2')).toBeVisible();
    await expect(tablet.getByText(/ · queued$/)).toHaveCount(0);
    // Latest first: the PLO hand played second, above the Hold'em hand played first.
    const hands = tablet.getByText(/^\d{2}:\d{2} · (Hold'em|PLO)$/);
    await expect(hands).toHaveText([/PLO$/, /Hold'em$/]);
    await revoke(floor, name);
  });
});
