/**
 * A set of starting hands, as a bitset over all 1,326 two-card combinations.
 *
 * Ranges get unioned, subtracted and tested for membership on every preflop
 * scenario the generator produces, so the representation is a `Uint32Array` of
 * 42 words rather than an array of pairs: membership is one shift and one mask,
 * and a union is 42 ORs regardless of how wide the range is.
 */

import { RANKS, RANK_VALUE, SUITS, type Card, type RankCode } from '../cards/cards.ts';

export const COMBO_COUNT = 1326;
const WORDS = Math.ceil(COMBO_COUNT / 32);
const DECK_SIZE = 52;

export type ComboSet = Uint32Array;

/** Card index 0..51, rank-major descending, matching DECK. */
const cardIndex = (card: Card): number => RANKS.indexOf(card.rank) * 4 + SUITS.indexOf(card.suit);

const CARD_BY_INDEX: readonly Card[] = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));

/**
 * Pair index, ordered so the table below is a simple triangular walk.
 *
 * Built once at module load rather than computed with the usual
 * `n*(n-1)/2` arithmetic, because the inverse is needed just as often and a
 * lookup pair is cheaper and harder to get subtly wrong than the closed form
 * and its inverse. `-1` marks a card paired with itself, which is no combination.
 */
const PAIR_INDEX = new Int16Array(DECK_SIZE * DECK_SIZE).fill(-1);
const PAIR_CARDS: (readonly [Card, Card])[] = [];
for (let a = 0; a < DECK_SIZE; a += 1) {
    for (let b = a + 1; b < DECK_SIZE; b += 1) {
        const next = PAIR_CARDS.length;
        PAIR_INDEX[a * DECK_SIZE + b] = next;
        PAIR_INDEX[b * DECK_SIZE + a] = next;
        PAIR_CARDS.push([cardAt(a), cardAt(b)]);
    }
}

function cardAt(index: number): Card {
    const card = CARD_BY_INDEX[index];
    if (card === undefined) throw new RangeError(`No card at index ${index}`);
    return card;
}

/** The value of one word of a set; every word below `WORDS` exists. */
const wordOf = (set: ComboSet, word: number): number => set[word] ?? 0;

/** A set with nothing in it. */
export function emptyCombos(): ComboSet {
    return new Uint32Array(WORDS);
}

/**
 * Every combination in the deck.
 *
 * The complement base: a rule that says what to do with the hands OUTSIDE its
 * range needs those hands drawn, and `subtractCombos(fullCombos(), range)` is
 * how. Without it the generator could only ever deal from the range, so the
 * whole "fold everything else" tier of a source was unreachable.
 *
 * The last word is masked rather than filled, because 1,326 is not a multiple
 * of 32 and the six spare high bits would otherwise be combinations that do not
 * exist — `countCombos` would report 1,332.
 */
export function fullCombos(): ComboSet {
    const set = new Uint32Array(WORDS).fill(0xffffffff);
    const spare = WORDS * 32 - COMBO_COUNT;
    if (spare > 0) set[WORDS - 1] = 0xffffffff >>> spare;
    return set;
}

/** The index of the combination made by two distinct cards, in either order. */
export function comboIndex(a: Card, b: Card): number {
    const index = PAIR_INDEX[cardIndex(a) * DECK_SIZE + cardIndex(b)] ?? -1;
    if (index < 0) throw new RangeError(`${a.rank}${a.suit} and ${b.rank}${b.suit} are not a combination`);
    return index;
}

/** The two cards of a combination index. */
export function comboCards(index: number): [Card, Card] {
    const pair = PAIR_CARDS[index];
    if (pair === undefined) throw new RangeError(`No combination at index ${index}`);
    return [pair[0], pair[1]];
}

/** Adds one combination to a set in place. */
export function addCombo(set: ComboSet, index: number): void {
    const word = index >>> 5;
    set[word] = wordOf(set, word) | (1 << (index & 31));
}

/** Whether a set holds a combination. */
export function hasCombo(set: ComboSet, index: number): boolean {
    return (wordOf(set, index >>> 5) & (1 << (index & 31))) !== 0;
}

/** How many combinations a set holds. */
export function countCombos(set: ComboSet): number {
    let total = 0;
    for (let word = 0; word < WORDS; word += 1) {
        let bits = wordOf(set, word);
        while (bits !== 0) {
            bits &= bits - 1;
            total += 1;
        }
    }
    return total;
}

/** A new set built word by word from two others. */
function combineWords(a: ComboSet, b: ComboSet, combine: (x: number, y: number) => number): ComboSet {
    const out = emptyCombos();
    for (let word = 0; word < WORDS; word += 1) out[word] = combine(wordOf(a, word), wordOf(b, word));
    return out;
}

/** Every combination in either set. */
export function unionCombos(a: ComboSet, b: ComboSet): ComboSet {
    return combineWords(a, b, (x, y) => x | y);
}

/** Every combination in `a` and not in `b`. */
export function subtractCombos(a: ComboSet, b: ComboSet): ComboSet {
    return combineWords(a, b, (x, y) => x & ~y);
}

/** Every combination in both sets. */
export function intersectCombos(a: ComboSet, b: ComboSet): ComboSet {
    return combineWords(a, b, (x, y) => x & y);
}

/** Whether two sets hold exactly the same combinations. */
export function equalCombos(a: ComboSet, b: ComboSet): boolean {
    for (let word = 0; word < WORDS; word += 1) {
        if (wordOf(a, word) !== wordOf(b, word)) return false;
    }
    return true;
}

/** Every combination in the set, in index order. */
export function combosToList(set: ComboSet): [Card, Card][] {
    const out: [Card, Card][] = [];
    for (let index = 0; index < COMBO_COUNT; index += 1) {
        if (hasCombo(set, index)) out.push(comboCards(index));
    }
    return out;
}

/** The 169-cell grid label for a combination: `AKs`, `AKo`, `QQ`. */
export function comboLabel(a: Card, b: Card): string {
    const [high, low] = RANK_VALUE[a.rank] >= RANK_VALUE[b.rank] ? [a, b] : [b, a];
    if (high.rank === low.rank) return `${high.rank}${low.rank}`;
    return `${high.rank}${low.rank}${high.suit === low.suit ? 's' : 'o'}`;
}

/** All combinations matching a 169-grid cell. Pairs give 6, suited 4, offsuit 12. */
export function cellCombos(high: RankCode, low: RankCode, form: 'pair' | 'suited' | 'offsuit'): ComboSet {
    const set = emptyCombos();
    const expected = form === 'pair' ? `${high}${low}` : `${high}${low}${form === 'suited' ? 's' : 'o'}`;
    PAIR_CARDS.forEach(([a, b], index) => {
        if (comboLabel(a, b) === expected) addCombo(set, index);
    });
    return set;
}
