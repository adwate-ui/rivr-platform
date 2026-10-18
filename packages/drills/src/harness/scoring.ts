/**
 * Scoring one quiz hand that a principle governs.
 */
import type { Card } from '../cards/cards.ts';
import type { Outcome, Principle, QuizHand } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import type { Arbitration } from '../grading/arbitrate.ts';
import {
    effectiveRule, resolveGoverning, resolveGoverningAny, type AnyResolution, type ResolveContext,
} from '../grading/resolve.ts';
import { actionKey, countKey, labelKey } from '../grading/answerKey.ts';
import { actionAnswerOf, authorKey, keyedAnswerOf } from './answers.ts';
import type { QuizResult } from './results.ts';

/** A readable hand, the principle arbitration chose for it, and how it was chosen. */
export interface GovernedHand {
    readonly quiz: QuizHand;
    readonly scenario: Scenario;
    readonly principle: Principle;
    readonly contest: Arbitration;
    readonly context: ResolveContext;
}

/** A resolution's answer, spelt as the reports spell it. */
function keyOf(resolution: AnyResolution): string {
    if (resolution.kind === 'classify') return labelKey(resolution.outcome.label);
    if (resolution.kind === 'count') return countKey(resolution.outcome.value);
    return actionKey(resolution.outcome);
}

/**
 * Compared on action and sizing; the sizing only has to match where the source
 * stated one. A rule's `acceptable_alternatives` are part of its outcome, not a
 * second answer the source must have written down.
 */
function actionMatches(actual: Outcome, answer: Outcome): boolean {
    const sameSizing = (actual.sizing ?? 'unspecified') === (answer.sizing ?? 'unspecified');
    const sizingOpen = answer.sizing === undefined || answer.sizing === 'unspecified';
    return actual.action === answer.action && (sameSizing || sizingOpen);
}

/** Scores a hand whose source gave an action. */
export function scoreAction({ quiz, scenario, principle, contest, context }: GovernedHand): QuizResult {
    const resolution = resolveGoverning(principle, scenario, context);
    const answer = actionAnswerOf(quiz);
    return {
        quizId: quiz.id,
        verdict: actionMatches(resolution.outcome, answer) ? 'pass' : 'fail',
        provenance: quiz.provenance,
        principleId: principle.id,
        expected: answer,
        actual: resolution.outcome,
        candidateCount: contest.candidateCount,
        governingSpecificity: contest.governingSpecificity,
        runnerUpId: contest.runnerUp?.id,
        runnerUpOutcome: contest.runnerUp === null
            ? undefined
            : resolveGoverning(contest.runnerUp, scenario, context).outcome,
    };
}

/**
 * The one heroless hand that cannot be scored: a count that takes the hero's
 * cards out of the range, from a hand that never said what they were. Counting
 * as though the hero held nothing would produce the wrong number while looking
 * like an answer.
 */
function removesUnnamedHeroCards(principle: Principle, scenario: Scenario): boolean {
    const { rule } = effectiveRule(principle);
    const held: readonly Card[] = scenario.hole;
    return rule.kind === 'count' && rule.dead_cards === 'hero' && held.length === 0;
}

/**
 * Scores a hand whose source gave a label or a number. Apart from the action
 * path because there is no sizing to half-match: a label is either the source's
 * or it is not. The runner-up is still reported, in the same key spelling,
 * because whether arbitration was load-bearing matters for a reading too.
 */
export function scoreAnswer({ quiz, scenario, principle, contest, context }: GovernedHand): QuizResult {
    const answer = keyedAnswerOf(quiz.author_answer);
    if (answer === undefined) throw new Error(`Quiz hand ${quiz.id} has no label or count to score.`);
    const record = {
        quizId: quiz.id,
        provenance: quiz.provenance,
        answerKind: answer.kind,
        principleId: principle.id,
        expectedKey: authorKey(answer),
        candidateCount: contest.candidateCount,
        governingSpecificity: contest.governingSpecificity,
        runnerUpId: contest.runnerUp?.id,
        runnerUpKey: contest.runnerUp === null
            ? undefined
            : keyOf(resolveGoverningAny(contest.runnerUp, scenario, context)),
    };
    if (removesUnnamedHeroCards(principle, scenario)) {
        const note = `${principle.id} removes the hero's cards from the range, and this hand does not say what they are.`;
        return { ...record, verdict: 'unusable', note };
    }
    const resolution = resolveGoverningAny(principle, scenario, context);
    const actualKey = keyOf(resolution);
    if (resolution.kind === 'count' && answer.kind === 'count') {
        const reproduced = Math.abs(resolution.outcome.value - answer.value) <= (answer.tolerance ?? 0);
        return { ...record, verdict: reproduced ? 'pass' : 'fail', actualKey, counted: resolution.outcome };
    }
    return { ...record, verdict: actualKey === record.expectedKey ? 'pass' : 'fail', actualKey };
}
