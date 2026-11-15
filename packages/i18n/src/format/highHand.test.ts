import { describe, expect, it } from 'vitest';
import { formatHandRank, formatHighHand, formatHighHandRules, formatListedHand } from './highHand.ts';

describe('formatListedHand', () => {
  it('names each hand of the fixed list as a promotion lists it', () => {
    expect(['royal_flush', 'straight_flush', 'four_of_a_kind', 'aces_full', 'full_house'].map(formatListedHand))
      .toEqual(['Royal flush', 'Straight flush', 'Four of a kind', 'Aces full', 'Any full house']);
  });

  it('shows a hand it does not know as it is', () => {
    expect(formatListedHand('flush')).toBe('flush');
  });
});

describe('formatHighHand', () => {
  it('names a hit exactly, with its rank where the hand has one', () => {
    expect(formatHighHand('royal_flush', null)).toBe('Royal flush');
    expect(formatHighHand('straight_flush', 'nine')).toBe('Straight flush, Nine high');
    expect(formatHighHand('four_of_a_kind', 'jack')).toBe('Four Jacks');
    expect(formatHighHand('four_of_a_kind', 'six')).toBe('Four Sixes');
    expect(formatHighHand('full_house', 'king')).toBe('Kings full');
    expect(formatHighHand('full_house', 'ace')).toBe('Aces full');
    expect(formatHighHand('aces_full', null)).toBe('Aces full');
  });

  it('falls back to the listed hand when the rank is missing or not one the hand has', () => {
    expect(formatHighHand('four_of_a_kind', null)).toBe('Four of a kind');
    expect(formatHighHand('straight_flush', 'ace')).toBe('Straight flush');
    expect(formatHighHand('full_house', 'joker')).toBe('Any full house');
  });
});

describe('formatHandRank', () => {
  it('names a straight flush\'s high card in the singular, and any other rank in the plural', () => {
    expect(formatHandRank('straight_flush', 'nine')).toBe('Nine');
    expect(formatHandRank('four_of_a_kind', 'nine')).toBe('Nines');
    expect(formatHandRank('full_house', 'ace')).toBe('Aces');
    expect(formatHandRank('four_of_a_kind', 'joker')).toBe('joker');
  });
});

describe('formatHighHandRules', () => {
  it('says the rules a promotion holds, in order, the players dealt in always', () => {
    expect(formatHighHandRules({ bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 }))
      .toEqual(['Both hole cards must play', 'Shown at showdown', '4 or more players dealt in']);
    expect(formatHighHandRules({ bothHoleCards: false, shownAtShowdown: true, minPlayersDealt: 2 })).toEqual(['Shown at showdown', '2 or more players dealt in']);
    expect(formatHighHandRules({ bothHoleCards: false, shownAtShowdown: false, minPlayersDealt: 6 })).toEqual(['6 or more players dealt in']);
  });
});
