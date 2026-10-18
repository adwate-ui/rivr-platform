/**
 * The facts about a board that every texture tag and runout tag is read from:
 * rank and suit counts, gaps, and the straight windows.
 *
 * Computed once per board so each predicate is a one-line question over
 * numbers rather than a fresh walk over the cards.
 */

import { RANK_VALUE, SUITS, type Card, type SuitCode } from './cards/cards.ts';

export class BadBoardError extends Error {
    constructor(readonly count: number) {
        super(`A board is three to five cards, got ${count}`);
        this.name = 'BadBoardError';
    }
}

export interface BoardFacts {
    /** Distinct rank values, descending. */
    readonly ranks: readonly number[];
    /** How many of each rank, indexed by rank value (0 and 1 unused). */
    readonly rankCounts: readonly number[];
    readonly suitCounts: Readonly<Record<SuitCode, number>>;
    readonly distinctSuits: number;
    readonly maxSuitCount: number;
    /** Highest rank value on the board. An ace is always the top card. */
    readonly highest: number;
    /** Smallest difference between any two distinct ranks; Infinity if only one. */
    readonly closestGap: number;
    /** Distinct board ranks that sit inside the most crowded five-rank window. */
    readonly bestWindowCount: number;
    /**
     * Could two hole cards make an OPEN-ENDED straight draw on this board?
     *
     * True when some run of four consecutive ranks holds at least two board
     * ranks — so two hole cards complete the run — and the run has a real card
     * at BOTH ends. The end test is what keeps the ace honest: A-K-Q-J and
     * 4-3-2-A are four in a row that draw to one card, not eight.
     */
    readonly openEnderPossible: boolean;
    /**
     * The two-rank holdings that would complete a straight: for every five-rank
     * window holding exactly three distinct board ranks, the two ranks missing
     * from it. Wheel-aware (an ace-low fill appears as rank 1). Deduplicated.
     */
    readonly straightFillPairs: readonly (readonly [number, number])[];
    /** Top of a five-in-a-row on the board itself, or 0. Wheel-aware. */
    readonly straightOnBoardTop: number;
    readonly cardCount: number;
}

/**
 * Rank values present, with the ace counted BOTH high and low.
 *
 * Straightness is the only place the ace is ambiguous, and getting it wrong is
 * the classic off-by-one: without the low ace, A-5-4-3-2 is four scattered
 * cards and a wheel draw is invisible.
 */
function straightRanks(ranks: readonly number[]): Set<number> {
    const set = new Set(ranks);
    if (set.has(14)) set.add(1);
    return set;
}

function rankCountsOf(board: readonly Card[]): number[] {
    const counts = new Array<number>(15).fill(0);
    for (const card of board) {
        const value = RANK_VALUE[card.rank];
        counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
}

function suitCountsOf(board: readonly Card[]): Record<SuitCode, number> {
    const counts: Record<SuitCode, number> = { h: 0, d: 0, c: 0, s: 0 };
    for (const card of board) counts[card.suit] += 1;
    return counts;
}

function distinctRanks(rankCounts: readonly number[]): number[] {
    const ranks: number[] = [];
    for (let value = 14; value >= 2; value -= 1) {
        if ((rankCounts[value] ?? 0) > 0) ranks.push(value);
    }
    return ranks;
}

function closestGapOf(ranks: readonly number[]): number {
    let closest = Infinity;
    ranks.forEach((rank, index) => {
        const next = ranks[index + 1];
        if (next !== undefined) closest = Math.min(closest, rank - next);
    });
    // The wheel wraps: on A-3-2 the ace sits one below the two, not eleven above the king.
    const lowest = ranks[ranks.length - 1];
    if (ranks.includes(14) && ranks.length > 1 && lowest !== undefined) closest = Math.min(closest, lowest - 1);
    return closest;
}

type WindowFacts = Pick<BoardFacts, 'bestWindowCount' | 'straightFillPairs' | 'straightOnBoardTop'>;

/** Every five-rank window, top down: how full it is, what fills it, and whether it is already full. */
function windowFacts(forStraights: ReadonlySet<number>): WindowFacts {
    let bestWindowCount = 0;
    let straightOnBoardTop = 0;
    const fillPairs = new Map<string, readonly [number, number]>();
    for (let top = 14; top >= 5; top -= 1) {
        const missing = [top, top - 1, top - 2, top - 3, top - 4].filter((rank) => !forStraights.has(rank));
        const inWindow = 5 - missing.length;
        bestWindowCount = Math.max(bestWindowCount, inWindow);
        const [higher, lower] = missing;
        if (inWindow === 3 && higher !== undefined && lower !== undefined) {
            fillPairs.set(`${lower}-${higher}`, [lower, higher]);
        }
        if (inWindow === 5 && straightOnBoardTop === 0) straightOnBoardTop = top;
    }
    return { bestWindowCount, straightOnBoardTop, straightFillPairs: [...fillPairs.values()] };
}

/**
 * Four in a row, open at both ends, with two cards supplied from hand.
 *
 * `top` stops at 13 because a run headed by the ace has nothing above it, and
 * the low end stops at 2 for the same reason at the other end: the run 4-3-2-A
 * draws only to the five. Runs are walked over the wheel-aware rank set, so A-2
 * counts where it should and the ace-low run is still rejected by the bottom
 * test rather than by pretending the ace is not there.
 */
function openEnderPossible(forStraights: ReadonlySet<number>): boolean {
    for (let top = 13; top >= 5; top -= 1) {
        const onBoard = [top, top - 1, top - 2, top - 3].filter((rank) => forStraights.has(rank)).length;
        if (onBoard >= 2 && onBoard < 4) return true;
    }
    return false;
}

/** The facts every board tag is read from. Throws on anything but three to five cards. */
export function boardFacts(board: readonly Card[]): BoardFacts {
    if (board.length < 3 || board.length > 5) throw new BadBoardError(board.length);

    const rankCounts = rankCountsOf(board);
    const suitCounts = suitCountsOf(board);
    const ranks = distinctRanks(rankCounts);
    const forStraights = straightRanks(ranks);
    const counts = SUITS.map((suit) => suitCounts[suit]);
    return {
        ranks,
        rankCounts,
        suitCounts,
        distinctSuits: counts.filter((count) => count > 0).length,
        maxSuitCount: Math.max(...counts),
        highest: ranks[0] ?? 0,
        closestGap: closestGapOf(ranks),
        ...windowFacts(forStraights),
        openEnderPossible: openEnderPossible(forStraights),
        cardCount: board.length,
    };
}
