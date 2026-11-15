import type { TvHighHand, TvHighHandPayout } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { toHighHandBoard } from './highHandBoard.ts';

const payout = (more: Partial<TvHighHandPayout> = {}): TvHighHandPayout => ({
  id: 'h2', at: '2026-11-15T21:13:00Z', name: 'Devansh M.', memberNumber: null, hand: 'four_of_a_kind', rank: 'jack', table: 'Table 2', chips: 5_000, ...more,
});
const board = (payouts: TvHighHandPayout[]): TvHighHand => ({
  promotionId: 'p9', name: 'High hand bonus', payouts,
  reward: {
    kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
    hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'four_of_a_kind', chips: 5_000 }],
  },
});
// A minute after Devansh's hand: 02:44 IST.
const NOW = new Date('2026-11-15T21:14:00Z');

describe('the High hand bonus board (redesign RD-25)', () => {
  it('lists the hands with their Bonus, and the rules on a line', () => {
    const shown = toHighHandBoard(board([]), NOW);
    expect(shown.hands.map((hand) => [hand.name, hand.bonus])).toEqual([['Royal flush', '25,000'], ['Straight flush', '10,000'], ['Four of a kind', '5,000']]);
    expect(shown.rules).toBe('Both hole cards must play · Shown at showdown · 4 or more players dealt in');
    expect([shown.handsTitle, shown.payoutsTitle, shown.emptyText]).toEqual(['Hit one, get paid', 'Paid tonight', 'None yet tonight.']);
  });

  it('names each payout: who, the hand, the table and the time, and its Bonus; the newest lit while it is fresh', () => {
    const shown = toHighHandBoard(board([payout(), payout({ id: 'h1', at: '2026-11-15T19:42:00Z', name: 'Siddharth V.', rank: 'nine', table: 'Table 3' })]), NOW);
    expect(shown.payouts).toEqual([
      { id: 'h2', name: 'Devansh M.', detail: 'Four Jacks · Table 2 · 02:43', bonus: '5,000', isNew: true },
      { id: 'h1', name: 'Siddharth V.', detail: 'Four Nines · Table 3 · 01:12', bonus: '5,000', isNew: false },
    ]);
    // Six minutes on, nothing is lit.
    expect(toHighHandBoard(board([payout()]), new Date('2026-11-15T21:19:00Z')).payouts[0]?.isNew).toBe(false);
  });

  it('shows a member who hid their name on the TVs by their member number', () => {
    const shown = toHighHandBoard(board([payout({ name: null, memberNumber: 17 }), payout({ id: 'h0', name: null })]), NOW);
    expect(shown.payouts.map((paid) => paid.name)).toEqual(['Member #17', 'A member']);
  });
});
