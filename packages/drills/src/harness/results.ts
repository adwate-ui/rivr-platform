/**
 * What the quiz harness reports, hand by hand and in total.
 */
import type { Outcome, ProvenanceForm, ProvenanceKind, QuizProvenance } from '../ontology/types.ts';
import type { CountOutcome } from '../range/onBoard.ts';

export type QuizVerdict = 'pass' | 'fail' | 'no-principle' | 'unusable' | 'indeterminate';

export interface NearestMiss {
    readonly principleId: string;
    /** `slot=value`, or `slot=UNSTATED` where the hand simply never said. */
    readonly blockedBy: readonly string[];
    /**
     * Whether it was encoded from the pages this hand cites. False means the
     * nearest rule comes from elsewhere in the source, which is evidence the
     * cited passage was never encoded: a different repair from narrowing a rule
     * that is about this spot.
     */
    readonly samePage: boolean;
}

export interface QuizResult {
    readonly quizId: string;
    readonly verdict: QuizVerdict;
    /** Where the hand came from, as the hand declared it; absent when it did not. */
    readonly provenance?: QuizProvenance | undefined;
    /** The principle that claimed the spot, where one did. */
    readonly principleId?: string | undefined;
    readonly expected?: Outcome | undefined;
    readonly actual?: Outcome | undefined;
    readonly note?: string | undefined;
    /** Set on `no-principle`: the closest principle, and what kept it out. */
    readonly nearestMiss?: NearestMiss | undefined;
    /** How many principles admitted the spot BEFORE arbitration narrowed it. */
    readonly candidateCount: number;
    /** Constrained-coordinate count of the governing principle. */
    readonly governingSpecificity?: number | undefined;
    readonly runnerUpId?: string | undefined;
    /**
     * What the second-ranked principle would have answered. If it agrees, the
     * ranking is low-stakes; if it disagrees, the ranking is load-bearing and
     * the tie-breaks deserve attention.
     */
    readonly runnerUpOutcome?: Outcome | undefined;
    /**
     * Set only where the question was not an action (1.9, 2.0). Absent means an
     * action, and the action fields above are then the whole record.
     */
    readonly answerKind?: 'classify' | 'count' | undefined;
    /** A label or count answer, spelt the way `answerKey` spells it (`label:x`, `count:21`). */
    readonly expectedKey?: string | undefined;
    readonly actualKey?: string | undefined;
    readonly runnerUpKey?: string | undefined;
    /** A count hand: what the range actually holds, with the working. */
    readonly counted?: CountOutcome | undefined;
}

/** Scored hands of one provenance: how many, how many a rule claimed, how many it got right. */
export interface ProvenanceBucket {
    /** `unstated` is a hand that declared no provenance, read as in-sample. */
    readonly kind: ProvenanceKind | 'unstated';
    readonly form: ProvenanceForm | 'unstated';
    readonly scored: number;
    readonly matched: number;
    readonly passed: number;
}

/** Scored, matched and passed counts for one group of hands. */
export interface Tally {
    readonly scored: number;
    readonly matched: number;
    readonly passed: number;
}

/**
 * The out-of-sample figure: probe and held-out hands pooled, then split.
 *
 * The interval is Clopper–Pearson 95% on `passed` of `matched` (accuracy on the
 * hands a rule claimed) and null until a rule has claimed one. Unmatched hands
 * stay visible in `scored`; a coverage hole is a finding, not a hand to drop.
 */
export interface OutOfSample extends Tally {
    readonly interval: readonly [number, number] | null;
    readonly literal: Tally;
    readonly instantiated: Tally;
}

/** How many count hands the engine's arithmetic reproduced, split the way the rate is. */
export interface CountTally {
    readonly scored: number;
    /** A rule claimed the hand and the engine computed a number. */
    readonly matched: number;
    /** That number is the source's, within the source's own hedge. */
    readonly reproduced: number;
    /** Probe and held-out count hands only. Null when there are none. */
    readonly outOfSample: { readonly scored: number; readonly matched: number; readonly reproduced: number } | null;
}

export interface HarnessReport {
    readonly results: readonly QuizResult[];
    /** Hands that counted toward the rate. */
    readonly scored: number;
    readonly passed: number;
    /** passed / scored, or 1 when there was nothing to score. */
    readonly passRate: number;
    readonly threshold: number;
    readonly meetsThreshold: boolean;
    /** Failures grouped by the principle that produced them. */
    readonly failuresByPrinciple: readonly { principleId: string; quizIds: readonly string[] }[];
    /** Scored hands by declared provenance, kinds and forms in schema order, empty buckets omitted. */
    readonly byProvenance: readonly ProvenanceBucket[];
    /** Null until at least one scored hand declares itself a probe or held out. */
    readonly outOfSample: OutOfSample | null;
    /**
     * Count hands, on their own line and nowhere else (2.0). A count pass says
     * the range was transcribed right and the counter works, not that the rules
     * say what the source says. With both right it is 100% by construction, so
     * mixing it into the pass rate would inflate it, and into the perfect-score
     * guard's population would trip the guard for the wrong reason. Null when
     * there are none.
     */
    readonly counts: CountTally | null;
}

/** A pass or a fail: a rule claimed the hand and answered it. */
export const isMatched = (result: QuizResult): boolean => result.verdict === 'pass' || result.verdict === 'fail';
