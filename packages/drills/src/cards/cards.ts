/**
 * The card vocabulary: what a rank is, what a suit is, and how card notation
 * maps onto them.
 *
 * One definition for the whole engine, so every classifier, the generator and
 * the hand history agree on what a card is and can be checked against each
 * other. It holds only what a card IS; drawing a card belongs to the UI. The
 * naming maps below are what turns a generated scenario into the sentence a
 * screen reader reads.
 */

export type SuitCode = 'h' | 'd' | 'c' | 's';
export type RankCode = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

/** One card, parsed. The shape every classifier takes and returns. */
export interface Card {
  rank: RankCode;
  suit: SuitCode;
}

/** Descending, which is the order a range grid and a hand history both use. */
export const RANKS: readonly RankCode[] = [
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

export const SUITS: readonly SuitCode[] = ['h', 'd', 'c', 's'];

/** Ace high. The only ranking the engine uses; the wheel is handled where straights are. */
export const RANK_VALUE: Readonly<Record<RankCode, number>> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

/** Ranks that make a Broadway straight, and that hand-filters treat as a group. */
export const BROADWAY: readonly RankCode[] = ['T', 'J', 'Q', 'K', 'A'];

export const SUIT_NAMES: Readonly<Record<SuitCode, string>> = {
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
  s: 'spades',
};

export const RANK_NAMES: Readonly<Record<RankCode, string>> = {
  A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten',
  '9': 'nine', '8': 'eight', '7': 'seven', '6': 'six',
  '5': 'five', '4': 'four', '3': 'three', '2': 'two',
};

/** What a rank is printed as. Notation uses `T`; a card says `10`. */
export const RANK_LABEL: Readonly<Record<RankCode, string>> = {
  A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10',
  '9': '9', '8': '8', '7': '7', '6': '6',
  '5': '5', '4': '4', '3': '3', '2': '2',
};

/**
 * All 52 cards in notation form, rank-major and descending. Rejection sampling
 * needs one, and so does any test that wants to sweep every card.
 */
export const DECK: readonly string[] = RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}`));

/** The same 52 cards as `DECK`, in the same order, already parsed. */
export const DECK_CARDS: readonly Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));

/** Whether a string is one of the thirteen rank codes. */
export function isRankCode(value: string): value is RankCode {
  return Object.prototype.hasOwnProperty.call(RANK_VALUE, value);
}

/** Whether a string is one of the four suit codes. */
export function isSuitCode(value: string): value is SuitCode {
  return Object.prototype.hasOwnProperty.call(SUIT_NAMES, value);
}

/**
 * Parses card notation. Accepts `As`, `Th`, and the three-character `10h`
 * that hand-entered notation often uses. Returns null for `back`, `??`, and
 * anything malformed, so a caller can draw a card back rather than nothing.
 */
export function parseCard(card: string): Card | null {
  if (!card || card.length < 2) return null;

  const suit = card.slice(-1).toLowerCase();
  if (!isSuitCode(suit)) return null;

  const rawRank = card.slice(0, card.length - 1).toUpperCase();
  const rank = rawRank === '10' ? 'T' : rawRank;
  if (!isRankCode(rank)) return null;

  return { rank, suit };
}

/**
 * Parses notation that must be valid: a fixture, a constant, a card the engine
 * itself wrote. Bad notation there is a bug, so this throws rather than return null.
 */
export function cardOrThrow(text: string): Card {
  const card = parseCard(text);
  if (card === null) throw new Error(`Not a card: ${text}`);
  return card;
}

/** Cards from run-together two-character notation such as `Ah7c2d`, each of which must be valid. */
export function cardsOrThrow(notation: string): Card[] {
  return (notation.match(/.{2}/g) ?? []).map(cardOrThrow);
}

/** The inverse of `parseCard` for the two-character form it prefers. */
export function formatCard(rank: RankCode, suit: SuitCode): string {
  return `${rank}${suit}`;
}
