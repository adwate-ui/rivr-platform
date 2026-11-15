import { describe, expect, it } from 'vitest';
import { highHandOffer } from './highHandOffer.ts';

describe('the high hand offer card (redesign RD-25)', () => {
  it('names the promotion, and each hand with its Bonus on a line', () => {
    const offer = highHandOffer({
      promotionId: 'p9', name: 'High hand bonus',
      reward: {
        kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
        hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'four_of_a_kind', chips: 5_000 }],
      },
    });
    expect(offer).toEqual({
      id: 'p9', title: 'High hand bonus', offer: 'High hand bonus', schedule: 'Royal flush 25,000 · Straight flush 10,000 · Four of a kind 5,000',
    });
  });
});
