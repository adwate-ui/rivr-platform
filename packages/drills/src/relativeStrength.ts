/**
 * How good the hero's hand is *for this board*.
 *
 * Split out from `handClass` deliberately, and the split is not stylistic. Hand
 * class is cheap combinatorics — count ranks, read off the answer — and can be
 * swept exhaustively in a test. This is enumerative: it deals every hand an
 * opponent could hold and ranks the hero against all of them, ~1,100
 * evaluations per call. Keeping them apart is what keeps the exhaustive fixture
 * for the cheap one affordable.
 *
 * **The definition, written out because it is a choice and not a fact.**
 * Enumerate every two-card combination from the cards neither on the board nor
 * in the hero's hand; score each against the same board; the percentile is the
 * fraction the hero beats or ties. It is BOARD-relative, not RANGE-relative — it
 * asks "how does this hold up against everything?", not "against what this
 * opponent would actually play". Range-relative is more accurate and needs a
 * villain range the ontology does not supply at this point. Saying so is better
 * than implying a precision that is not there.
 */

import { DECK_CARDS, type Card } from './cards/cards.ts';
import type { RelativeStrength } from './ontology/types.ts';
import { evaluate } from './cards/eval7.ts';
import { BadHoleCardsError } from './handClass.ts';

/**
 * Where each bucket begins, as a percentile.
 *
 * A judgement call at every boundary. What matters is that the numbers are
 * here, named, and changeable in one place rather than implied by a chain of
 * comparisons — a source that disagrees can be re-bucketed without touching the
 * enumeration.
 */
export const STRENGTH_THRESHOLDS: Readonly<Record<Exclude<RelativeStrength, 'weak'>, number>> = {
    nuts: 0.99,
    strong: 0.85,
    medium: 0.55,
};

const sameCard = (a: Card, b: Card): boolean => a.rank === b.rank && a.suit === b.suit;

/**
 * The fraction of possible opposing hands the hero beats or ties, in [0, 1].
 *
 * 1 means nothing else can be ahead. The comparison is against every remaining
 * two-card combination, so this is a property of the hero's hand and the board
 * alone — two identical spots always give the same number.
 */
export function handPercentile(hole: readonly Card[], board: readonly Card[]): number {
    if (hole.length !== 2) throw new BadHoleCardsError(hole.length);

    const dead = [...hole, ...board];
    const live = DECK_CARDS.filter((card) => !dead.some((used) => sameCard(used, card)));
    return countNotAhead(live, board, evaluate(dead));
}

/** The share of opposing two-card hands from `live` that do not beat `heroScore` on `board`. */
function countNotAhead(live: readonly Card[], board: readonly Card[], heroScore: number): number {
    // One array, rewritten in place: the inner loop runs ~1,100 times per call
    // and allocating a fresh seven-card array each time is the whole cost. The
    // first two slots are overwritten before every evaluation.
    const buffer: Card[] = [...live.slice(0, 2), ...board];
    let notAhead = 0;
    let total = 0;
    live.forEach((first, i) => {
        buffer[0] = first;
        for (let j = i + 1; j < live.length; j += 1) {
            const second = live[j];
            if (second === undefined) continue;
            buffer[1] = second;
            total += 1;
            if (evaluate(buffer) <= heroScore) notAhead += 1;
        }
    });
    return notAhead / total;
}

/** The bucket a percentile falls in, by `STRENGTH_THRESHOLDS`. */
export function bucketPercentile(percentile: number): RelativeStrength {
    if (percentile >= STRENGTH_THRESHOLDS.nuts) return 'nuts';
    if (percentile >= STRENGTH_THRESHOLDS.strong) return 'strong';
    if (percentile >= STRENGTH_THRESHOLDS.medium) return 'medium';
    return 'weak';
}

/** How strong the hero's hand is on this board, as a bucket. */
export function classifyRelativeStrength(hole: readonly Card[], board: readonly Card[]): RelativeStrength {
    return bucketPercentile(handPercentile(hole, board));
}
