/**
 * The perfect-score convention: perfection is a failing condition.
 *
 * Against a prose source whose worked examples lean on reads, table history
 * and prior action no coordinate captures, perfect fidelity is not achievable.
 * When it appears on a corpus of meaningful size, something was fitted: an
 * earlier encoding reached 42/42 and later 48/48, and both were fit states.
 *
 * Two independent trips, because the two metrics fail differently:
 *
 * - `passRate === 1` — every scored hand matched AND answered correctly. The
 *   original convention.
 * - `accuracyOnMatched === 1` — every hand a rule claims is answered
 *   correctly, however many hands nothing covers. This one exists because a
 *   guard that watches only the diluted raw rate cannot protect the metric
 *   that replaced it: the next fit will narrow rules and leave coverage
 *   holes, which reads as a sub-threshold pass rate over a perfectly-answered
 *   matched set — exactly the profile the first condition waves through.
 *
 * Below ~20 hands a young corpus can legitimately be perfect; failing it
 * would punish starting. The minimum applies to each condition's own
 * denominator: scored for the raw rate, matched for accuracy.
 */
export const PERFECT_SCORE_MIN = 20;

export interface PerfectScoreInput {
    readonly passRate: number;
    readonly scored: number;
    readonly accuracyOnMatched: number;
    readonly matched: number;
}

/** The trips that fired, empty when the result is believably imperfect. */
export function perfectScoreTrips(input: PerfectScoreInput): string[] {
    const trips: string[] = [];
    if (input.passRate === 1 && input.scored >= PERFECT_SCORE_MIN) {
        trips.push(`raw pass rate 100% on ${input.scored} scored hands`);
    }
    if (input.accuracyOnMatched === 1 && input.matched >= PERFECT_SCORE_MIN) {
        trips.push(`accuracy on matched 100% on ${input.matched} matched hands`);
    }
    return trips;
}
