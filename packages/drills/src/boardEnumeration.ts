/**
 * Every flop, and every flop that is actually DIFFERENT.
 *
 * C(52,3) = 22,100 flops exist, but only 1,755 of them are distinct once you
 * stop caring which suit is which — Ah-Kd-7c and As-Kh-7d are the same board to
 * every rule in the ontology. Enumerating the 1,755 is what makes an exhaustive
 * classifier regression affordable; committing them would be 1,755 lines of
 * fixture nobody reads.
 *
 * So they are generated here, and the generator proves itself: `canonicalFlops`
 * must produce exactly 1,755 classes. That number is not a magic constant — it
 * is a checkable fact about a 52-card deck, and if the collapse below were
 * wrong (too eager, or not eager enough) the count would not land on it.
 *
 * Production code rather than test scaffolding, because the validator needs it
 * too: stage 5 derives which board tags can co-occur by asking this enumeration
 * rather than by asserting a table somebody wrote from memory.
 */

import { DECK_CARDS, RANK_VALUE, SUITS, type Card, type SuitCode } from './cards/cards.ts';

/** A relabelling of the four suits: each suit to the one it becomes. */
export type SuitPermutation = Readonly<Record<SuitCode, SuitCode>>;

/** Every ordering of the four suits, depth-first, so the list order is fixed. */
function suitOrderings(rest: readonly SuitCode[], acc: readonly SuitCode[]): SuitCode[][] {
    if (rest.length === 0) return [[...acc]];
    return rest.flatMap((suit, index) =>
        suitOrderings([...rest.slice(0, index), ...rest.slice(index + 1)], [...acc, suit]));
}

/** Maps the n-th suit of SUITS (h, d, c, s) to the n-th suit of an ordering of all four. */
function asPermutation(ordering: readonly SuitCode[]): SuitPermutation {
    const [h = 'h', d = 'd', c = 'c', s = 's'] = ordering;
    return { h, d, c, s };
}

/** All 24 relabellings of the four suits. */
export const SUIT_PERMUTATIONS: readonly SuitPermutation[] = suitOrderings(SUITS, []).map(asPermutation);

/** Relabels a hand's suits by the given permutation. */
export function applySuitPermutation(cards: readonly Card[], perm: SuitPermutation): Card[] {
    return cards.map((card) => ({ rank: card.rank, suit: perm[card.suit] }));
}

/** An order-independent key for a set of cards. */
function cardsKey(cards: readonly Card[]): string {
    return cards
        .map((card) => `${RANK_VALUE[card.rank].toString(16).padStart(2, '0')}${card.suit}`)
        .sort()
        .join('');
}

/**
 * A key identifying a board up to suit isomorphism.
 *
 * Takes the smallest key over all 24 suit relabellings rather than relabelling
 * by first appearance. First-appearance is cheaper and is wrong on any board
 * with a repeated rank, where two cards' suits are interchangeable and "first"
 * depends on an ordering the caller never promised.
 */
export function canonicalKey(cards: readonly Card[]): string {
    return SUIT_PERMUTATIONS
        .map((perm) => cardsKey(applySuitPermutation(cards, perm)))
        .reduce((best, key) => (key < best ? key : best));
}

/** All C(52,3) = 22,100 flops. */
export function allFlops(): Card[][] {
    return DECK_CARDS.flatMap((first, i) =>
        DECK_CARDS.slice(i + 1).flatMap((second, j) =>
            DECK_CARDS.slice(i + j + 2).map((third) => [first, second, third])));
}

let cached: { key: string; flop: Card[] }[] | null = null;

/** One representative flop per suit-isomorphism class, sorted by key. */
export function canonicalFlops(): { key: string; flop: Card[] }[] {
    if (cached !== null) return cached;

    const byKey = new Map<string, Card[]>();
    for (const flop of allFlops()) {
        const key = canonicalKey(flop);
        if (!byKey.has(key)) byKey.set(key, flop);
    }
    cached = [...byKey.entries()]
        .map(([key, flop]) => ({ key, flop }))
        .sort((a, b) => (a.key < b.key ? -1 : 1));
    return cached;
}

/** Readable notation for a board, for test names and failure messages. */
export function show(cards: readonly Card[]): string {
    return cards.map((card) => `${card.rank}${card.suit}`).join(' ');
}
