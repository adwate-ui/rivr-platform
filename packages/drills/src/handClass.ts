/**
 * What the hero actually has: a `hand_class` and the draws that go with it.
 *
 * The governing principle, and the one that makes this more than a wrapper over
 * `evaluate`: **a class describes what the HERO'S CARDS contribute**, not what
 * the seven cards happen to make. On A-A-7-7-3 a hero holding 5-2 is playing a
 * board that beats him; `evaluate` correctly reports two pair, and reporting
 * `two_pair` here would produce a drill asking how to value a hand the hero does
 * not have. Where the hole cards add nothing, the class is `no_pair`.
 *
 * Kicker line, stated once so it is not re-litigated per call: a top pair kicker
 * of ten or better is `top_pair_good_kicker`, anything below is
 * `top_pair_weak_kicker`. It is a judgement call, it is arbitrary at the margin,
 * and the only thing that matters is that it is written down.
 */

import { RANK_VALUE, type Card } from './cards/cards.ts';
import type { DrawClass, HandClass } from './ontology/types.ts';
import { evaluate, categoryOf, HAND_CATEGORY } from './cards/eval7.ts';
import { classifyDraws } from './draws.ts';

/** Kicker at or above this makes a top pair a good one. */
export const GOOD_KICKER_MIN = 10;

export class BadHoleCardsError extends Error {
    constructor(readonly count: number) {
        super(`A hold 'em hand is exactly two cards, got ${count}`);
        this.name = 'BadHoleCardsError';
    }
}

export interface MadeHand {
    readonly handClass: HandClass;
    /** Every draw that applies. `['none']` when there are none. */
    readonly draws: DrawClass[];
}

const valuesOf = (cards: readonly Card[]): number[] => cards.map((card) => RANK_VALUE[card.rank]);

/** How many of each rank value appear across the cards, by value. */
function rankCounts(cards: readonly Card[]): Map<number, number> {
    const counts = new Map<number, number>();
    for (const value of valuesOf(cards)) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
}

/**
 * Ranks the hero has genuinely paired: present in the hole AND appearing at
 * least twice across all seven cards.
 */
function heroPairedRanks(hole: readonly Card[], board: readonly Card[]): Set<number> {
    const counts = rankCounts([...hole, ...board]);
    return new Set(valuesOf(hole).filter((value) => (counts.get(value) ?? 0) >= 2));
}

/**
 * Nothing made. An ace in the hand is still a hand: the best no-pair holding is
 * often worth a call where a lower one is not, so it gets its own class and
 * everything else is `no_pair`.
 */
const unmade = (hole: readonly Card[]): HandClass =>
    (hole.some((card) => card.rank === 'A') ? 'ace_high' : 'no_pair');

/** A pocket pair, against the top card of the board. */
function pocketPairClass(pair: number, boardTop: number): HandClass {
    return pair > boardTop ? 'overpair' : 'underpair';
}

/**
 * One hole card paired the board: which board rank it matched, and for top pair
 * the other hole card as the kicker. The hero ranks differ (a pocket pair is
 * handled before this), so exactly one of them is the paired rank.
 */
function pairedCardClass(pairedRank: number, heroValues: readonly number[], boardValues: readonly number[]): HandClass {
    const [boardTop, boardSecond] = boardValues;
    if (pairedRank === boardSecond) return 'second_pair';
    if (pairedRank !== boardTop) return 'weak_pair';
    const kicker = heroValues.find((value) => value !== pairedRank) ?? 0;
    return kicker >= GOOD_KICKER_MIN ? 'top_pair_good_kicker' : 'top_pair_weak_kicker';
}

function classifyPair(hole: readonly Card[], board: readonly Card[]): HandClass {
    const paired = heroPairedRanks(hole, board);
    // The pair is on the board and the hero is not in it.
    if (paired.size === 0) return unmade(hole);

    const heroValues = valuesOf(hole).sort((a, b) => b - a);
    const boardValues = [...new Set(valuesOf(board))].sort((a, b) => b - a);
    const [heroHigh = 0, heroLow = 0] = heroValues;
    if (heroHigh === heroLow) return pocketPairClass(heroHigh, boardValues[0] ?? 0);
    return pairedCardClass(Math.max(...paired), heroValues, boardValues);
}

/**
 * Three of a kind the HERO made: a pocket pair that hit, or one hole card
 * matching a paired board. Trips sitting entirely on the board are nobody's
 * set — `A♥K♦` on `Q♣Q♠Q♥7♦` once classified as a set, and every rule written
 * for sets was dealt it. The same hero-contribution test `two_pair` makes.
 */
function classifyTrips(hole: readonly Card[], board: readonly Card[]): HandClass {
    const tripsRank = [...rankCounts([...hole, ...board]).entries()].find(([, count]) => count >= 3)?.[0];
    const heroHolds = tripsRank !== undefined && valuesOf(hole).includes(tripsRank);
    return heroHolds ? 'set' : unmade(hole);
}

/** The class for an evaluated category, where the hole cards add something. */
function classForCategory(category: number, hole: readonly Card[], board: readonly Card[]): HandClass {
    if (category >= HAND_CATEGORY.FULL_HOUSE) return 'full_house_plus';
    if (category === HAND_CATEGORY.FLUSH) return 'flush';
    if (category === HAND_CATEGORY.STRAIGHT) return 'straight';
    if (category === HAND_CATEGORY.TRIPS) return classifyTrips(hole, board);
    if (category === HAND_CATEGORY.TWO_PAIR) return heroPairedRanks(hole, board).size > 0 ? 'two_pair' : unmade(hole);
    if (category === HAND_CATEGORY.PAIR) return classifyPair(hole, board);
    return unmade(hole);
}

/**
 * The hero's made hand and draws.
 *
 * Takes exactly two hole cards and a three-to-five card board, and throws rather
 * than guessing at anything else — a classifier that quietly accepts one hole
 * card produces drills nobody can answer.
 */
export function classifyMadeHand(hole: readonly Card[], board: readonly Card[]): MadeHand {
    if (hole.length !== 2) throw new BadHoleCardsError(hole.length);

    const score = evaluate([...hole, ...board]);
    const draws = classifyDraws(hole, board);

    // At the river the board can be the whole hand. An identical score with and
    // without the hole cards means they add exactly nothing.
    if (board.length === 5 && evaluate(board) === score) return { handClass: 'no_pair', draws };

    return { handClass: classForCategory(categoryOf(score), hole, board), draws };
}
