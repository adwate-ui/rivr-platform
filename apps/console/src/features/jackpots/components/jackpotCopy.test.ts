import type { JackpotEvent } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { eventText, jackpotFailureText, payoutName, previewText, ruleText } from './jackpotCopy.ts';

const PAYOUT: JackpotEvent = {
  eventId: 'e1', kind: 'payout', isReversed: false, tableName: 'Table 3', loserName: 'Arjun Mehta', winnerName: 'Kabir Sethi', others: 4,
  loser: fromPaise(17130000n), winner: fromPaise(8565000n), eachAtTable: fromPaise(2140000n), total: fromPaise(34255000n), reason: null,
  createdAt: '2026-10-19T16:30:00Z',
};

describe('what the Jackpots screen says', () => {
  it('writes the payout rule in percentages', () => {
    expect(ruleText({ poolShare: 10000n, loser: 5000n, winner: 2500n, table: 2500n }))
      .toBe('A bad beat pays 100% of the jackpot: 50% to the loser, 25% to the winner, 25% shared by the others dealt in.');
  });

  it('shows what a payout comes to before it is paid, with or without others dealt in', () => {
    const payout = { loser: fromPaise(17130000n), winner: fromPaise(8565000n), eachAtTable: fromPaise(2140000n), total: fromPaise(34255000n) };
    expect(previewText(payout, 4)).toBe('Loser ₹1,71,300 · winner ₹85,650 · ₹21,400 each to 4 others');
    expect(previewText({ ...payout, eachAtTable: fromPaise(0n) }, 0)).toBe('Loser ₹1,71,300 · winner ₹85,650');
  });

  it('lists a payout and its reversal with the IST time', () => {
    expect(eventText(PAYOUT)).toBe('19 Oct 2026, 22:00 · Table 3 · Arjun Mehta lost to Kabir Sethi · ₹3,42,550');
    expect(eventText({ ...PAYOUT, kind: 'reversal', reason: 'Wrong table' })).toBe('19 Oct 2026, 22:00 · Reversed: Wrong table · ₹3,42,550 back to the jackpot');
    expect(eventText({ ...PAYOUT, loserName: null, winnerName: null })).toBe('19 Oct 2026, 22:00 · Table 3 · bad beat paid · ₹3,42,550');
  });

  it('names a payout by its time, table and amount, so each reversal field and button is its own', () => {
    expect(payoutName(PAYOUT)).toBe('19 Oct 2026, 22:00 at Table 3, ₹3,42,550');
  });

  it('says why a payout did not go through', () => {
    expect(jackpotFailureText('not_member')).toBe('One of those numbers is not a member here. Check the numbers.');
    expect(jackpotFailureText('switched_off')).toBe('Promotions are switched off, so no jackpot is paid until they are back on.');
    expect(jackpotFailureText('already_reversed')).toBe('That payout is already reversed.');
  });
});
