/**
 * Sorting surviving failures into buckets, where the DISTRIBUTION across buckets
 * is the finding. Concentrated means a work list; spread across many principles
 * means conditional prose was flattened into rules whose scope does not match
 * what the source claimed, and the answer is re-encoding rather than patching.
 */
import type { OntologyPayload, Principle, Situation } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { arbitrate, SPECIFICITY_SLOTS, specificity, type Ranked } from '../grading/arbitrate.ts';
import { effectiveRule, resolveGoverning, type ResolveContext } from '../grading/resolve.ts';
import { expandRangeSets } from '../range/expand.ts';
import { actionAnswerOf } from './answers.ts';
import { handsById, readGraded, type GradedHand } from './gradedHand.ts';
import { gradesCorrect } from './padAnswers.ts';
import type { HarnessReport } from './results.ts';

/**
 * Why a failure failed, as far as the machine can honestly tell.
 *
 * `indeterminate` is deliberately not one of these. Marking a hand
 * indeterminate drops it from scoring, so it is the bucket everything drifts
 * into, and the justification has to come from the source rather than from the
 * fact that nothing got it right. That stays an owner's decision with a reason.
 */
export type FailureBucket =
    | 'lost_to_a_more_specific_rule'
    | 'sizing_only'
    | 'possibly_too_broad'
    | 'wrong_outcome';

export interface TriagedFailure {
    readonly quizId: string;
    readonly bucket: FailureBucket;
    readonly governingPrincipleId: string;
    readonly governingWidth: number;
    /** Set on `lost_to_a_more_specific_rule`: the candidate that had it right. */
    readonly correctCandidateId?: string | undefined;
    /**
     * Coordinates the hand STATES and the governing rule does not constrain:
     * the work list for a too-broad rule, each one a coordinate to check against
     * the source.
     */
    readonly unconstrainedButStated: readonly string[];
}

const isEmpty = (value: unknown): boolean => value === undefined || (Array.isArray(value) && value.length === 0);

/** Which of a scenario's coordinates carry a value the rule ignores. */
function unconstrainedButStated(scenario: Scenario, situation: Situation): string[] {
    const stated: Readonly<Record<string, unknown>> = {
        hero_position: scenario.heroPosition,
        villain_position: scenario.villainPosition,
        pot_type: scenario.potType,
        player_count: scenario.playerCount,
        stack_bracket: scenario.stackBracket,
        spr_bracket: scenario.sprBracket,
        preflop_facing_state: scenario.preflopFacingState,
        postflop_facing_state: scenario.postflopFacingState,
        villain_raise_size: scenario.villainRaiseSize,
        villain_types: scenario.villainType,
        hand_class_any: scenario.handClass,
        draw_class_any: scenario.draws,
        relative_strength_any: scenario.relativeStrength,
        runout_any: scenario.runouts?.join('+'),
    };
    return SPECIFICITY_SLOTS
        .filter((slot) => !isEmpty(stated[slot]) && isEmpty(situation[slot]))
        .map(String);
}

/** The governing principle again, with no texture or kind: the action question, as triage asks it. */
function governingOf(
    hand: GradedHand,
    payload: OntologyPayload,
    context: ResolveContext,
): { governing: Principle; ranked: readonly Ranked[] } {
    const contest = arbitrate(hand.scenario, payload.principles, context);
    if (contest.governing === null) throw new Error(`Failed quiz hand ${hand.quiz.id} has no governing principle.`);
    return { governing: contest.governing, ranked: contest.ranked };
}

/** Another candidate that would have answered as the source did. */
function rescuerOf(
    hand: GradedHand,
    governing: Principle,
    ranked: readonly Ranked[],
    context: ResolveContext,
): Ranked | undefined {
    const author = actionAnswerOf(hand.quiz);
    return ranked
        .filter((entry) => entry.principle.id !== governing.id)
        .find((entry) => {
            const outcome = resolveGoverning(entry.principle, hand.scenario, context).outcome;
            return gradesCorrect({ action: outcome.action, sizing: outcome.sizing }, author);
        });
}

/**
 * A rule that picks the right action and the wrong size disagrees with the
 * source about one word; one that picks the wrong action disagrees about the
 * decision. Lumping them together hides the cheapest thing to fix.
 */
function bucketFor(rescued: boolean, sizingOnly: boolean, ignoresStated: boolean): FailureBucket {
    if (rescued) return 'lost_to_a_more_specific_rule';
    if (sizingOnly) return 'sizing_only';
    return ignoresStated ? 'possibly_too_broad' : 'wrong_outcome';
}

/** One failure, bucketed. */
function triageOne(hand: GradedHand, payload: OntologyPayload, context: ResolveContext): TriagedFailure {
    const { governing, ranked } = governingOf(hand, payload, context);
    const situation = effectiveRule(governing).rule.situation;
    // Did any OTHER candidate have it right? Then the correct rule lost the
    // ranking, and the fix is to narrow the winner, not to touch the right rule.
    const rescuer = rescuerOf(hand, governing, ranked, context);
    const ignored = unconstrainedButStated(hand.scenario, situation);
    const sizingOnly = hand.result.actual?.action === hand.result.expected?.action;
    return {
        quizId: hand.result.quizId,
        bucket: bucketFor(rescuer !== undefined, sizingOnly, ignored.length > 0),
        governingPrincipleId: governing.id,
        governingWidth: specificity(situation),
        correctCandidateId: rescuer?.principle.id,
        unconstrainedButStated: ignored,
    };
}

/**
 * Every surviving wrong answer, sorted into exactly one bucket. Action failures
 * only: a wrong label or count has no sizing and no rescuing action.
 *
 * Run this AFTER arbitration: before it, the governing principle is decided by
 * declaration order, and a triage list built then blames the wrong rules.
 */
export function triage(report: HarnessReport, payload: OntologyPayload): TriagedFailure[] {
    const context = { ranges: expandRangeSets(payload.range_sets) };
    const hands = handsById(payload);
    return report.results
        .filter((result) => result.verdict === 'fail' && result.answerKind === undefined)
        .map((result) => triageOne(readGraded(result, hands, payload), payload, context));
}

/** Bucket -> how many failures landed in it, biggest first. */
export function bucketCounts(
    failures: readonly TriagedFailure[],
): { bucket: FailureBucket; failures: number }[] {
    const counts = new Map<FailureBucket, number>();
    failures.forEach((failure) => counts.set(failure.bucket, (counts.get(failure.bucket) ?? 0) + 1));
    return [...counts.entries()]
        .map(([bucket, count]) => ({ bucket, failures: count }))
        .sort((a, b) => b.failures - a.failures || a.bucket.localeCompare(b.bucket));
}
