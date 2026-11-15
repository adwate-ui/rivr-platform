/**
 * High hand payout (redesign RD-25; decision 0624). While a high hand runs, Ananya Sen's Home has its offer card, with the
 * hands and their Bonus. Om Bajaj, an admin, seats her at Table 2 and logs her straight flush, Nine high. Her app, open on
 * Home, says so at once in a toast that names the hand and the Bonus; her Bonus is 10,000 more, and the newest line of
 * its history names the hand. 165 Om and 262 Ananya are the flow's own. Local stack only: it puts a high hand live in the
 * local database and ends it.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { seatOnFloor } from '../support/floor.ts';
import { endHighHands, endSeatOf, liveHighHand, shoot } from '../support/highHand.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const ANANYA = '00000000-0000-4000-8000-000000000262';
const NAME = `High hand bonus ${Date.now().toString(36).slice(-5)}`;
const HANDS = 'Royal flush 25,000 · Straight flush 10,000 · Four of a kind 5,000';

const tab = (member: Page, name: string) => member.getByRole('navigation').getByRole('link', { name, exact: true });

/**
 * Resolves once her app hears the database's changes: Realtime says "Subscribed to PostgreSQL" a moment after the app
 * joins its channel, and a Bonus added before then would be told only at the next read.
 */
function hearsChanges(member: Page): Promise<void> {
  return new Promise((resolve) => {
    member.on('websocket', (socket) => socket.on('framereceived', (frame) => {
      if (String(frame.payload).includes('Subscribed to PostgreSQL')) resolve();
    }));
  });
}

/** Her Bonus as its tile says it, in whole Bonus. */
async function balanceOf(member: Page): Promise<number> {
  await tab(member, 'Bonus').click();
  const tile = member.getByText('Balance', { exact: true }).locator('..');
  await expect(tile).toContainText(/\d/);
  const figure = /[\d,]+/.exec((await tile.innerText()).replace('Balance', ''));
  return Number((figure?.[0] ?? '').replaceAll(',', ''));
}

/** Om logs Ananya's straight flush, Nine high, from the floor's strip. */
async function payStraightFlush(floor: Page) {
  await floor.getByRole('region', { name: 'High hand bonus' }).getByRole('button', { name: 'Log a high hand' }).click();
  const panel = floor.getByRole('dialog', { name: 'Log a high hand' });
  await panel.getByRole('radio', { name: 'Table 2' }).click();
  await panel.getByRole('radio', { name: 'Ananya Sen' }).click();
  await panel.getByRole('radio', { name: 'Straight flush · 10,000' }).click();
  await panel.getByRole('radiogroup', { name: 'High card' }).getByRole('radio', { name: 'Nine' }).click();
  for (const rule of ['Both hole cards played', 'Shown at showdown', '4 or more players dealt in']) await panel.getByRole('switch', { name: rule }).click();
  await panel.getByRole('button', { name: 'Pay 10,000 Bonus' }).click();
  await expect(floor.getByText('10,000 Bonus paid to Ananya Sen for Straight flush, Nine high')).toBeVisible({ timeout: 10_000 });
}

test.describe('High hand payout', () => {
  test.skip(isRemoteTarget(), 'puts a high hand live in the local database, so the local stack only');

  test('the offer card, then a payout: a toast that names the hand, the balance at once and a line in the history', async ({ browser }) => {
    test.setTimeout(180_000);
    endSeatOf(ANANYA);
    liveHighHand(NAME);
    const member = await browser.newPage();
    const isListening = hearsChanges(member);
    await signInToPlayer(member, '9000000262');
    const card = member.getByRole('region', { name: 'Offers', exact: true }).getByRole('listitem').filter({ hasText: HANDS });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText(NAME);
    await card.scrollIntoViewIfNeeded();
    await shoot(member, 'player-home-offer-390');
    const before = await balanceOf(member);
    await tab(member, 'Home').click();

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000165');
    await seatOnFloor(floor, { table: 'Table 2', seat: 1, number: '9000000262' });
    await isListening;
    await payStraightFlush(floor);

    // Her app is open on Home: it says so at once.
    await expect(member.getByText('High hand: Straight flush, Nine high. 10,000 Bonus added.')).toBeVisible({ timeout: 20_000 });
    await shoot(member, 'player-home-toast-390');
    expect(await balanceOf(member)).toBe(before + 10_000);
    const newest = member.getByText('High hand: Straight flush, Nine high', { exact: true }).first();
    await expect(newest).toBeVisible();
    // Its row: the label with its day beneath, and the Bonus beside them.
    await expect(member.locator('div').filter({ hasText: /^High hand: Straight flush, Nine high\d+ [A-Z][a-z]{2}\+10,000$/ }).first()).toBeVisible();
    await shoot(member, 'player-bonus-history-390');

    // Ended, and her seat with it, so no other flow meets them.
    endHighHands();
    endSeatOf(ANANYA);
  });
});
