import { describe, expect, it } from 'vitest';
import { highestHandChips, highHandPayout, ranksOf, type HighHandHit, type HighHandReward } from './highHand.ts';

const RULES = { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 };
const CLUB: HighHandReward = {
  kind: 'high_hand', rules: RULES,
  hands: [
    { hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'four_of_a_kind', chips: 5_000 },
    { hand: 'aces_full', chips: 2_000 }, { hand: 'full_house', chips: 1_000 },
  ],
};
const CONFIRMED = { bothHoleCards: true, shownAtShowdown: true, playersDealt: true };
const hit = (hand: HighHandHit['hand'], rank: HighHandHit['rank'] = null, confirmed: Partial<HighHandHit['confirmed']> = {}): HighHandHit =>
  ({ hand, rank, confirmed: { ...CONFIRMED, ...confirmed } });

describe('ranksOf', () => {
  it('gives a straight flush its high card, king down to five', () => {
    expect(ranksOf('straight_flush')).toEqual(['king', 'queen', 'jack', 'ten', 'nine', 'eight', 'seven', 'six', 'five']);
  });

  it('gives four of a kind and a full house every rank, aces first', () => {
    expect(ranksOf('four_of_a_kind')).toHaveLength(13);
    expect(ranksOf('full_house')[0]).toBe('ace');
    expect(ranksOf('full_house')[12]).toBe('two');
  });

  it('gives a royal flush and Aces full no rank', () => {
    expect(ranksOf('royal_flush')).toEqual([]);
    expect(ranksOf('aces_full')).toEqual([]);
  });
});

describe('highHandPayout', () => {
  it('pays the listed hand its own Bonus, with the rank it was hit at', () => {
    expect(highHandPayout(CLUB, hit('four_of_a_kind', 'jack'))).toEqual({ ok: true, value: { hand: 'four_of_a_kind', rank: 'jack', chips: 5_000 } });
    expect(highHandPayout(CLUB, hit('royal_flush'))).toEqual({ ok: true, value: { hand: 'royal_flush', rank: null, chips: 25_000 } });
    expect(highHandPayout(CLUB, hit('straight_flush', 'five'))).toEqual({ ok: true, value: { hand: 'straight_flush', rank: 'five', chips: 10_000 } });
  });

  it('pays a full house of three aces as Aces full where the promotion lists it', () => {
    expect(highHandPayout(CLUB, hit('full_house', 'ace'))).toEqual({ ok: true, value: { hand: 'aces_full', rank: null, chips: 2_000 } });
    expect(highHandPayout(CLUB, hit('aces_full'))).toEqual({ ok: true, value: { hand: 'aces_full', rank: null, chips: 2_000 } });
    expect(highHandPayout(CLUB, hit('full_house', 'king'))).toEqual({ ok: true, value: { hand: 'full_house', rank: 'king', chips: 1_000 } });
  });

  it('pays Aces full as any full house where only that is listed, and not at all where neither is', () => {
    const anyFullHouse: HighHandReward = { ...CLUB, hands: [{ hand: 'full_house', chips: 500 }] };
    expect(highHandPayout(anyFullHouse, hit('aces_full'))).toEqual({ ok: true, value: { hand: 'full_house', rank: 'ace', chips: 500 } });
    expect(highHandPayout(anyFullHouse, hit('full_house', 'ace'))).toEqual({ ok: true, value: { hand: 'full_house', rank: 'ace', chips: 500 } });
    const acesOnly: HighHandReward = { ...CLUB, hands: [{ hand: 'aces_full', chips: 2_000 }] };
    expect(highHandPayout(acesOnly, hit('full_house', 'king'))).toEqual({ ok: false, error: 'hand_not_listed' });
    expect(highHandPayout(acesOnly, hit('royal_flush'))).toEqual({ ok: false, error: 'hand_not_listed' });
  });

  it('refuses a rank the hand cannot have, a rank left out, and a rank where the hand has none', () => {
    expect(highHandPayout(CLUB, hit('straight_flush', 'ace'))).toEqual({ ok: false, error: 'wrong_rank' });
    expect(highHandPayout(CLUB, hit('straight_flush', 'four'))).toEqual({ ok: false, error: 'wrong_rank' });
    expect(highHandPayout(CLUB, hit('four_of_a_kind'))).toEqual({ ok: false, error: 'wrong_rank' });
    expect(highHandPayout(CLUB, hit('royal_flush', 'ace'))).toEqual({ ok: false, error: 'wrong_rank' });
    expect(highHandPayout(CLUB, hit('aces_full', 'ace'))).toEqual({ ok: false, error: 'wrong_rank' });
  });

  it('refuses a hit with a rule the promotion holds left unconfirmed, naming the first', () => {
    expect(highHandPayout(CLUB, hit('royal_flush', null, { bothHoleCards: false }))).toEqual({ ok: false, error: 'both_hole_cards_not_confirmed' });
    expect(highHandPayout(CLUB, hit('royal_flush', null, { shownAtShowdown: false }))).toEqual({ ok: false, error: 'showdown_not_confirmed' });
    expect(highHandPayout(CLUB, hit('royal_flush', null, { playersDealt: false }))).toEqual({ ok: false, error: 'players_not_confirmed' });
    expect(highHandPayout(CLUB, hit('royal_flush', null, { bothHoleCards: false, shownAtShowdown: false, playersDealt: false })))
      .toEqual({ ok: false, error: 'both_hole_cards_not_confirmed' });
    expect(highHandPayout(CLUB, hit('royal_flush', null, { shownAtShowdown: false, playersDealt: false }))).toEqual({ ok: false, error: 'showdown_not_confirmed' });
  });

  it('asks only for the rules the promotion holds, and always for the players dealt in', () => {
    const loose: HighHandReward = { ...CLUB, rules: { bothHoleCards: false, shownAtShowdown: false, minPlayersDealt: 2 } };
    expect(highHandPayout(loose, hit('royal_flush', null, { bothHoleCards: false, shownAtShowdown: false })).ok).toBe(true);
    expect(highHandPayout(loose, hit('royal_flush', null, { playersDealt: false }))).toEqual({ ok: false, error: 'players_not_confirmed' });
    const holeCardsOnly: HighHandReward = { ...CLUB, rules: { ...RULES, shownAtShowdown: false } };
    expect(highHandPayout(holeCardsOnly, hit('royal_flush', null, { shownAtShowdown: false })).ok).toBe(true);
    expect(highHandPayout(holeCardsOnly, hit('royal_flush', null, { bothHoleCards: false }))).toEqual({ ok: false, error: 'both_hole_cards_not_confirmed' });
  });

  it('says a hand is not listed before it looks at its rank or the rules', () => {
    const royalOnly: HighHandReward = { ...CLUB, hands: [{ hand: 'royal_flush', chips: 25_000 }] };
    expect(highHandPayout(royalOnly, hit('four_of_a_kind', null, { playersDealt: false }))).toEqual({ ok: false, error: 'hand_not_listed' });
    expect(highHandPayout(CLUB, hit('four_of_a_kind', null, { playersDealt: false }))).toEqual({ ok: false, error: 'wrong_rank' });
  });
});

describe('highestHandChips', () => {
  it('is the most the promotion pays for one hand', () => {
    expect(highestHandChips(CLUB)).toBe(25_000);
    expect(highestHandChips({ ...CLUB, hands: [{ hand: 'full_house', chips: 500 }, { hand: 'aces_full', chips: 750 }] })).toBe(750);
  });
});
