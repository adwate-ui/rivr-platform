import { describe, it, expect } from 'vitest';
import {
  RANKS,
  SUITS,
  RANK_VALUE,
  BROADWAY,
  SUIT_NAMES,
  RANK_NAMES,
  RANK_LABEL,
  DECK,
  isRankCode,
  isSuitCode,
  parseCard,
  formatCard,
  type Card,
} from './cards.ts';

/**
 * The shared card vocabulary.
 *
 * The tests that matter here assert the tables are COMPLETE and mutually
 * consistent, not that any single lookup returns what it obviously returns. A
 * rank present in RANKS but missing from RANK_VALUE is exactly the drift this
 * file exists to prevent.
 */

/** Parses a card a test knows is valid; a null here is a broken test. */
function card(notation: string): Card {
  const parsed = parseCard(notation);
  if (parsed === null) throw new Error(`not a card: ${notation}`);
  return parsed;
}

describe('the rank and suit tables', () => {
  it('covers all thirteen ranks and four suits, descending and ace-high', () => {
    expect(RANKS).toHaveLength(13);
    expect(SUITS).toHaveLength(4);
    expect(RANKS[0]).toBe('A');
    expect(RANKS[12]).toBe('2');
    expect(RANK_VALUE.A).toBe(14);
    expect(RANK_VALUE['2']).toBe(2);
  });

  it('gives every rank a strictly descending value, so RANKS order is the ranking', () => {
    const values = RANKS.map((rank) => RANK_VALUE[rank]);
    values.slice(1).forEach((value, i) => {
      expect(value).toBeLessThan(values[i] ?? Number.NaN);
    });
  });

  it.each([
    ['RANK_VALUE', RANK_VALUE],
    ['RANK_NAMES', RANK_NAMES],
    ['RANK_LABEL', RANK_LABEL],
  ])('keys %s by exactly the ranks in RANKS, with nothing extra', (_label, table) => {
    expect(Object.keys(table).sort()).toEqual([...RANKS].sort());
  });

  it('keys SUIT_NAMES by exactly the suits in SUITS', () => {
    expect(Object.keys(SUIT_NAMES).sort()).toEqual([...SUITS].sort());
  });

  it('labels the ten as 10 while notation keeps calling it T', () => {
    expect(RANK_LABEL.T).toBe('10');
    expect(RANKS).toContain('T');
    expect(RANK_LABEL.A).toBe('A');
  });

  it('names a card the way it should be read aloud', () => {
    expect(RANK_NAMES.A).toBe('ace');
    expect(SUIT_NAMES.h).toBe('hearts');
  });

  it('counts Broadway as the five ranks that make a Broadway straight', () => {
    expect([...BROADWAY].sort()).toEqual(['A', 'J', 'K', 'Q', 'T']);
    BROADWAY.forEach((rank) => expect(RANK_VALUE[rank]).toBeGreaterThanOrEqual(10));
  });
});

describe('DECK', () => {
  it('is 52 distinct cards', () => {
    expect(DECK).toHaveLength(52);
    expect(new Set(DECK).size).toBe(52);
  });

  it('is every rank crossed with every suit, and nothing else', () => {
    const expected = RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));
    expect([...DECK].sort()).toEqual(expected.sort());
  });

  it('parses back to the rank and suit it was built from', () => {
    DECK.forEach((notation) => {
      expect(parseCard(notation)).not.toBeNull();
      const parsed = card(notation);
      expect(formatCard(parsed.rank, parsed.suit)).toBe(notation);
    });
  });
});

describe('isRankCode / isSuitCode', () => {
  it('accepts every member of its own table', () => {
    RANKS.forEach((rank) => expect(isRankCode(rank)).toBe(true));
    SUITS.forEach((suit) => expect(isSuitCode(suit)).toBe(true));
  });

  it.each(['x', '10', 'a', '', 'toString'])('rejects %s as a rank', (value) => {
    expect(isRankCode(value)).toBe(false);
  });

  it.each(['x', 'H', '', 'constructor'])('rejects %s as a suit', (value) => {
    expect(isSuitCode(value)).toBe(false);
  });
});

describe('parseCard', () => {
  it.each([
    ['As', { rank: 'A', suit: 's' }],
    ['Th', { rank: 'T', suit: 'h' }],
    ['10h', { rank: 'T', suit: 'h' }],
    ['2c', { rank: '2', suit: 'c' }],
  ] as const)('parses %s', (notation, expected) => {
    expect(parseCard(notation)).toEqual(expected);
  });

  it('is case-insensitive in both halves', () => {
    expect(parseCard('aS')).toEqual({ rank: 'A', suit: 's' });
    expect(parseCard('tH')).toEqual({ rank: 'T', suit: 'h' });
  });

  it.each([
    ['an empty string', ''],
    ['a single character', 's'],
    ['a card back', 'back'],
    ['an unknown suit', 'Ax'],
    ['an unknown rank', 'Zs'],
    ['the ?? placeholder', '??'],
  ])('returns null for %s', (_label, notation) => {
    expect(parseCard(notation)).toBeNull();
  });
});

describe('formatCard', () => {
  it('writes the two-character form, using T rather than 10', () => {
    expect(formatCard('T', 'h')).toBe('Th');
    expect(formatCard('A', 's')).toBe('As');
  });

  it('round-trips anything parseCard accepts', () => {
    (['As', 'Th', '2c', 'Kd'] as const).forEach((notation) => {
      const parsed = card(notation);
      expect(formatCard(parsed.rank, parsed.suit)).toBe(notation);
    });
  });
});
