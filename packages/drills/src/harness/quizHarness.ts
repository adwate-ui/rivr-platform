/**
 * Checking the encoding against the source's own worked examples.
 *
 * This is what turns extraction fidelity from a judgement call into pass/fail.
 * A source's quiz hands are spots where it stated its own answer; if the
 * encoding reproduces those answers it is probably faithful, and if it does not
 * it is definitely not.
 *
 * Three rules shape the whole thing:
 *
 * **Failures are grouped by principle.** One badly encoded rule failing six
 * hands is a thing you fix; six points off an aggregate is a thing you shrug at.
 *
 * **`indeterminate` hands are excluded from scoring.** Where the source gave no
 * single answer there is nothing to be right or wrong about, and counting them
 * would mean the pass rate measured the encoder's guesses.
 *
 * **Quiz hands are held out of the drill pool permanently.** Drilling the
 * examples you validated against measures memory of the fixtures, not of the
 * rules, and would make the pass rate self-fulfilling.
 */
import type { AnswerKind, OntologyPayload, QuizHand } from '../ontology/types.ts';
import { answerKindOfAnswer } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { expandRangeSets } from '../range/expand.ts';
import type { ComboSet } from '../range/comboSet.ts';
import { arbitrate } from '../grading/arbitrate.ts';
import { answerKindOf, effectiveRule, type ResolveContext } from '../grading/resolve.ts';
import { authorKey, keyedAnswerOf } from './answers.ts';
import { nearestMiss } from './nearestMiss.ts';
import { scenarioFromQuizHand } from './parse/quizScenario.ts';
import { scoreAction, scoreAnswer } from './scoring.ts';
import { countTally, outOfSampleOf, provenanceBuckets } from './tally.ts';
import type { HarnessReport, QuizResult } from './results.ts';

export type {
    CountTally, HarnessReport, NearestMiss, OutOfSample, ProvenanceBucket, QuizResult, QuizVerdict,
} from './results.ts';
export { bracketForStack, scenarioFromQuizHand, villainTypeFromNotes } from './parse/quizScenario.ts';
export { admitsQuizHand, admittingPrinciples, missedCoordinates, nearestMiss, pageSpan } from './nearestMiss.ts';

export const DEFAULT_THRESHOLD = 0.85;

/** The fields every result for this hand starts with. Only non-action hands are tagged with their kind. */
function baseResult(quiz: QuizHand) {
    const keyed = keyedAnswerOf(quiz.author_answer);
    return {
        quizId: quiz.id,
        provenance: quiz.provenance,
        ...(keyed === undefined ? {} : { answerKind: keyed.kind, expectedKey: authorKey(keyed) }),
    };
}

/**
 * How the hand is resolved. The context carries the hand's stated table texture
 * so modifiers fire under the harness exactly as they do at drill time (an
 * unstated texture fires none), and the kind of question the source answered,
 * so a label is never checked against an action rule that happens to fit.
 */
function contextFor(quiz: QuizHand, ranges: ReadonlyMap<string, ComboSet>, kind: AnswerKind): ResolveContext {
    const texture = quiz.situation_instance.game_texture;
    return texture === undefined ? { ranges, answerKind: kind } : { ranges, gameTexture: texture, answerKind: kind };
}

/** The no-principle result, with the nearest rule that asks the same kind of question. */
function uncovered(quiz: QuizHand, scenario: Scenario, payload: OntologyPayload, kind: AnswerKind): QuizResult {
    const sameKind = payload.principles.filter((candidate) => answerKindOf(effectiveRule(candidate).rule) === kind);
    return {
        ...baseResult(quiz),
        verdict: 'no-principle',
        candidateCount: 0,
        note: 'No principle in this source covers the spot, so the encoding has a hole in it.',
        nearestMiss: nearestMiss(scenario, sameKind, quiz.page_ref),
    };
}

/** One quiz hand, read, arbitrated and scored. */
function scoreQuizHand(quiz: QuizHand, payload: OntologyPayload, ranges: ReadonlyMap<string, ComboSet>): QuizResult {
    if (quiz.indeterminate === true) {
        const note = 'The source gives no single answer, so this is excluded from the rate.';
        return { ...baseResult(quiz), verdict: 'indeterminate', candidateCount: 0, note };
    }
    const scenario = scenarioFromQuizHand(quiz, payload);
    if (scenario === null) {
        const note = 'Needs exactly two hole cards (none is allowed on a count) and an empty or three-to-five card board.';
        return { ...baseResult(quiz), verdict: 'unusable', candidateCount: 0, note };
    }
    const kind = answerKindOfAnswer(quiz.author_answer);
    const context = contextFor(quiz, ranges, kind);
    // Arbitration, not declaration order: the same call the drill grader makes.
    const contest = arbitrate(scenario, payload.principles, context);
    if (contest.governing === null) return uncovered(quiz, scenario, payload, kind);
    const hand = { quiz, scenario, principle: contest.governing, contest, context };
    return kind === 'action' ? scoreAction(hand) : scoreAnswer(hand);
}

/** Failed hands, grouped by the principle that produced them. */
function failuresByPrinciple(results: readonly QuizResult[]): HarnessReport['failuresByPrinciple'] {
    const grouped = new Map<string, string[]>();
    for (const result of results) {
        if (result.verdict !== 'fail' || result.principleId === undefined) continue;
        grouped.set(result.principleId, [...(grouped.get(result.principleId) ?? []), result.quizId]);
    }
    return [...grouped.entries()].map(([principleId, quizIds]) => ({ principleId, quizIds }));
}

/**
 * The totals. `no-principle` and `unusable` count against the rate: a hand the
 * encoding cannot answer is a hand it got wrong, and excluding them would let a
 * source improve its score by covering less. Count hands are the one exclusion,
 * and they go on their own line (see `HarnessReport.counts`).
 */
function summarise(results: QuizResult[], payload: OntologyPayload): HarnessReport {
    const graded = results.filter((result) => result.verdict !== 'indeterminate');
    const scored = graded.filter((result) => result.answerKind !== 'count');
    const passed = scored.filter((result) => result.verdict === 'pass').length;
    const passRate = scored.length === 0 ? 1 : passed / scored.length;
    const threshold = payload.source.quiz_pass_threshold ?? DEFAULT_THRESHOLD;
    return {
        results,
        scored: scored.length,
        passed,
        passRate,
        threshold,
        meetsThreshold: passRate >= threshold,
        failuresByPrinciple: failuresByPrinciple(results),
        byProvenance: provenanceBuckets(scored),
        outOfSample: outOfSampleOf(scored),
        counts: countTally(graded.filter((result) => result.answerKind === 'count')),
    };
}

/**
 * Runs every quiz hand in a payload.
 *
 * The threshold comes from the source itself and is meant to be set before the
 * first run: a threshold chosen after seeing the score is a rationalisation.
 */
export function runHarness(payload: OntologyPayload): HarnessReport {
    const ranges = expandRangeSets(payload.range_sets);
    const results = (payload.quiz_hands ?? []).map((quiz) => scoreQuizHand(quiz, payload, ranges));
    return summarise(results, payload);
}

/** Ids of every quiz hand's principle, so the drill queue can hold them out. */
export function heldOutPrincipleIds(report: HarnessReport): Set<string> {
    const ids = new Set<string>();
    report.results.forEach((result) => {
        if (result.principleId !== undefined) ids.add(result.principleId);
    });
    return ids;
}

/**
 * Whether a source may become `active`. A source that cannot reproduce its own
 * answers should not be grading anybody, so this gates the lifecycle.
 */
export function mayActivate(report: HarnessReport): boolean {
    return report.meetsThreshold;
}
