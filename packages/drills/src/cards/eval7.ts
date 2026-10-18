/**
 * Five-of-seven hand evaluation, as one comparable number.
 *
 * The engine's one hand evaluator. `relativeStrength` runs about 1,200
 * evaluations per classification and needs an exact ordering, so everything
 * that ranks hands goes through `evaluate` and no two places can disagree about
 * which hand wins.
 *
 * The result is a single integer: higher beats lower, equal ties. Nothing reads
 * its internals, so the packing below is free to change as long as the ORDER
 * does not.
 *
 * Cards arrive in the shared `Card` vocabulary and are converted to rank values
 * here, at this boundary, and never leave as numbers. That keeps one card model
 * while letting the hot loop count in a `number[]` rather than walk objects.
 *
 * The algorithm is categorical rather than combinatorial: count ranks and suits
 * once, then read the best hand off those counts. Scoring all C(7,5) = 21
 * five-card subsets and taking the max is 21 times the work for the same answer.
 */

import { RANK_VALUE, SUITS, type Card, type SuitCode } from './cards.ts';

/** Ascending, so a larger category always beats a smaller one. */
export const HAND_CATEGORY = {
    HIGH_CARD: 0,
    PAIR: 1,
    TWO_PAIR: 2,
    TRIPS: 3,
    STRAIGHT: 4,
    FLUSH: 5,
    FULL_HOUSE: 6,
    QUADS: 7,
    STRAIGHT_FLUSH: 8,
} as const;

export type HandCategory = typeof HAND_CATEGORY[keyof typeof HAND_CATEGORY];

/** Every category, indexed by its own value, so a number can be read back as one. */
const CATEGORIES: readonly HandCategory[] = Object.values(HAND_CATEGORY);

export const CATEGORY_NAMES: Readonly<Record<HandCategory, string>> = {
    [HAND_CATEGORY.HIGH_CARD]: 'high card',
    [HAND_CATEGORY.PAIR]: 'pair',
    [HAND_CATEGORY.TWO_PAIR]: 'two pair',
    [HAND_CATEGORY.TRIPS]: 'three of a kind',
    [HAND_CATEGORY.STRAIGHT]: 'straight',
    [HAND_CATEGORY.FLUSH]: 'flush',
    [HAND_CATEGORY.FULL_HOUSE]: 'full house',
    [HAND_CATEGORY.QUADS]: 'four of a kind',
    [HAND_CATEGORY.STRAIGHT_FLUSH]: 'straight flush',
};

export class NotEnoughCardsError extends Error {
    constructor(readonly count: number) {
        super(`Hand evaluation needs at least 5 cards, got ${count}`);
        this.name = 'NotEnoughCardsError';
    }
}

/** Five tiebreak slots in base 16, under a category. Fits well inside int32. */
const TIEBREAK_SLOTS = 5;
const BASE = 16;

/** An absent tiebreak packs as zero, below every real rank. */
function pack(category: HandCategory, tiebreaks: readonly (number | undefined)[]): number {
    let score: number = category;
    for (let i = 0; i < TIEBREAK_SLOTS; i += 1) {
        score = score * BASE + (tiebreaks[i] ?? 0);
    }
    return score;
}

/** Reads a packed score back apart. For tests and for explaining a grade. */
export function unpack(score: number): { category: HandCategory; tiebreaks: number[] } {
    const tiebreaks: number[] = [];
    let rest = score;
    for (let i = 0; i < TIEBREAK_SLOTS; i += 1) {
        tiebreaks.unshift(rest % BASE);
        rest = Math.floor(rest / BASE);
    }
    const category = CATEGORIES[rest];
    if (category === undefined) throw new RangeError(`${score} is not a packed hand score`);
    return { category, tiebreaks };
}

/**
 * Highest rank completing a 5-run in `mask`, or 0 for none.
 *
 * The ace is added back in at rank 1 when present, which is the whole of
 * wheel handling: A-5-4-3-2 becomes a run topped by the five, and because the
 * scan runs downward a wheel can only ever be found after every higher
 * straight has been ruled out.
 */
function straightTop(mask: number): number {
    const withWheel = mask & (1 << 14) ? mask | (1 << 1) : mask;
    for (let top = 14; top >= 5; top -= 1) {
        const run = (1 << top) | (1 << (top - 1)) | (1 << (top - 2)) | (1 << (top - 3)) | (1 << (top - 4));
        if ((withWheel & run) === run) return top;
    }
    return 0;
}

interface CardCounts {
    /** Indexed 0..14 so a rank value indexes directly; 0 and 1 stay unused. */
    readonly rankCounts: number[];
    readonly rankMask: number;
    readonly suitMasks: Record<SuitCode, number>;
    readonly suitCounts: Record<SuitCode, number>;
}

function countCards(cards: readonly Card[]): CardCounts {
    const rankCounts = new Array<number>(15).fill(0);
    const suitMasks = { h: 0, d: 0, c: 0, s: 0 };
    const suitCounts = { h: 0, d: 0, c: 0, s: 0 };
    let rankMask = 0;
    for (const card of cards) {
        const value = RANK_VALUE[card.rank];
        rankCounts[value] = (rankCounts[value] ?? 0) + 1;
        rankMask |= 1 << value;
        suitMasks[card.suit] |= 1 << value;
        suitCounts[card.suit] += 1;
    }
    return { rankCounts, rankMask, suitMasks, suitCounts };
}

/** The flush or straight flush score, or null when no suit has five cards. */
function flushScore(counts: CardCounts): number | null {
    const flushSuit = SUITS.find((suit) => counts.suitCounts[suit] >= 5);
    if (flushSuit === undefined) return null;
    const suitMask = counts.suitMasks[flushSuit];
    const straightFlushTop = straightTop(suitMask);
    if (straightFlushTop > 0) return pack(HAND_CATEGORY.STRAIGHT_FLUSH, [straightFlushTop]);
    const ranks: number[] = [];
    for (let value = 14; value >= 2 && ranks.length < 5; value -= 1) {
        if (suitMask & (1 << value)) ranks.push(value);
    }
    return pack(HAND_CATEGORY.FLUSH, ranks);
}

interface RankGroups {
    readonly quads: number[];
    readonly trips: number[];
    readonly pairs: number[];
    readonly singles: number[];
}

/** Ranks grouped by how many of them there are, each group descending. */
function groupRanks(rankCounts: readonly number[]): RankGroups {
    const groups: RankGroups = { quads: [], trips: [], pairs: [], singles: [] };
    const byCount: Readonly<Record<number, number[]>> = {
        4: groups.quads, 3: groups.trips, 2: groups.pairs, 1: groups.singles,
    };
    for (let value = 14; value >= 2; value -= 1) {
        byCount[rankCounts[value] ?? 0]?.push(value);
    }
    return groups;
}

const highest = (values: readonly number[]): number | undefined => [...values].sort((a, b) => b - a)[0];

/** Quads and full houses: the hands a set of trips or better makes. */
function setScore({ quads, trips, pairs, singles }: RankGroups): number | null {
    if (quads.length > 0) return pack(HAND_CATEGORY.QUADS, [quads[0], highest([...trips, ...pairs, ...singles])]);
    // Two sets of trips is a full house using the higher as the trips; the
    // second set can only ever contribute its top two cards.
    if (trips.length >= 2) return pack(HAND_CATEGORY.FULL_HOUSE, [trips[0], trips[1]]);
    if (trips.length === 1 && pairs.length > 0) return pack(HAND_CATEGORY.FULL_HOUSE, [trips[0], pairs[0]]);
    return null;
}

/** Trips, two pair, a pair or high card, once nothing better is available. */
function lowScore({ trips, pairs, singles }: RankGroups): number {
    if (trips.length === 1) return pack(HAND_CATEGORY.TRIPS, [trips[0], ...singles.slice(0, 2)]);
    if (pairs.length >= 2) {
        return pack(HAND_CATEGORY.TWO_PAIR, [pairs[0], pairs[1], highest([...pairs.slice(2), ...singles])]);
    }
    if (pairs.length === 1) return pack(HAND_CATEGORY.PAIR, [pairs[0], ...singles.slice(0, 3)]);
    return pack(HAND_CATEGORY.HIGH_CARD, singles.slice(0, 5));
}

/**
 * Scores the best five-card hand available in `cards`.
 *
 * Takes 5, 6 or 7 cards — the flop-with-hole case is 5, the river case is 7 —
 * and throws below that rather than inventing a ranking for an incomplete hand.
 */
export function evaluate(cards: readonly Card[]): number {
    if (cards.length < 5) throw new NotEnoughCardsError(cards.length);
    const counts = countCards(cards);
    const flush = flushScore(counts);
    if (flush !== null) return flush;
    const groups = groupRanks(counts.rankCounts);
    const madeSet = setScore(groups);
    if (madeSet !== null) return madeSet;
    const runTop = straightTop(counts.rankMask);
    if (runTop > 0) return pack(HAND_CATEGORY.STRAIGHT, [runTop]);
    return lowScore(groups);
}

/** The category alone, for the places that want to name a hand rather than rank it. */
export function categoryOf(score: number): HandCategory {
    return unpack(score).category;
}
