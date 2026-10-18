/**
 * What the harness found, broken down one hand at a time.
 *
 * A pass rate is a single number standing in for two unrelated things —
 * whether the rules say what the source says, and whether there are enough of
 * them — and it moves when either changes. That makes it useless for deciding
 * what to do next. This decomposes it.
 *
 * **Passes are emitted too, and that is the point.** A pass produced by a
 * width-1 rule that claimed a spot a width-5 rule should have claimed is a
 * latent failure: it is right today by coincidence of ranking, and it will
 * change the moment either rule is edited. Only the per-hand record shows that;
 * the aggregate cannot.
 */

import type { Outcome, OntologyPayload } from '../ontology/types.ts';
import type { HarnessReport, QuizResult } from './results.ts';
import { actionKey } from '../grading/answerKey.ts';

/**
 * `action:sizing`, and deliberately NOT `outcomeKey`.
 *
 * `outcomeKey` folds `acceptable_alternatives` into the string, which is right
 * for determinacy — two branches offering different alternatives are different
 * outcomes — and wrong here. The question this answers is "would the runner-up
 * have said the same thing?", and a rule that says bet-medium says bet-medium
 * whether or not it also tolerates a check.
 */
const answerKey = (outcome: Outcome): string => actionKey(outcome);

export type HandOutcome = 'pass' | 'fail' | 'unmatched';

export interface DecompositionRow {
    readonly quiz_hand_id: string;
    /** For tracing an answer back to the passage it came from. */
    readonly page_ref: string | null;
    readonly outcome: HandOutcome;
    /** Winner after arbitration; null when nothing matched. */
    readonly governing_principle_id: string | null;
    readonly governing_specificity: number | null;
    /** How many principles matched before arbitration. */
    readonly candidate_count: number;
    readonly runner_up_id: string | null;
    /** `action:sizing` of the second-ranked principle's answer. */
    readonly runner_up_would_have_answered: string | null;
    readonly expected_action: string | null;
    readonly expected_sizing: string | null;
    readonly actual_action: string | null;
    readonly actual_sizing: string | null;
    /** Unmatched hands only: the coordinate that excluded this hand. */
    readonly blocking_coordinate: string | null;
    readonly nearest_principle_id: string | null;
    /**
     * Whether the nearest principle was encoded from the pages this hand cites.
     *
     * `false` says the passage itself is probably unencoded, which is a
     * different repair from narrowing a rule that is genuinely about this spot.
     */
    readonly nearest_is_same_page: boolean | null;
    /**
     * Present only on a hand whose question was a label (1.9); an action row
     * has none of these, and reads exactly as it did before labels existed.
     * The answers are spelt as `answerKey` spells them (`label:strong_fit`).
     */
    readonly answer_kind?: 'classify';
    readonly expected_answer?: string;
    readonly actual_answer?: string | null;
}

const sizingOf = (outcome: Outcome | undefined): string | null => outcome?.sizing ?? null;
const actionOf = (outcome: Outcome | undefined): string | null => outcome?.action ?? null;

/**
 * `unusable` folds into `unmatched`.
 *
 * Both mean no governing principle produced an answer, which is the same thing
 * from the encoding's point of view. They stay distinguishable in the row:
 * an unusable hand has no `nearest_principle_id`, because there was no readable
 * spot to find a neighbour for.
 */
const outcomeFor = (verdict: QuizResult['verdict']): HandOutcome => {
    if (verdict === 'pass') return 'pass';
    if (verdict === 'fail') return 'fail';
    return 'unmatched';
};

/** The row's answer columns for a hand whose question was a label; empty for an action. */
function labelColumns(result: QuizResult): Pick<DecompositionRow, 'answer_kind' | 'expected_answer' | 'actual_answer'> {
    if (result.answerKind !== 'classify' || result.expectedKey === undefined) return {};
    return { answer_kind: result.answerKind, expected_answer: result.expectedKey, actual_answer: result.actualKey ?? null };
}

/** What the runner-up would have said: its own key for a label or count, its action otherwise. */
function runnerUpAnswer(result: QuizResult): string | null {
    if (result.runnerUpKey !== undefined) return result.runnerUpKey;
    return result.runnerUpOutcome === undefined ? null : answerKey(result.runnerUpOutcome);
}

/** The nearest-miss columns, null on a hand that matched or could not be read. */
function missColumns(result: QuizResult): Pick<DecompositionRow, 'blocking_coordinate' | 'nearest_principle_id' | 'nearest_is_same_page'> {
    const miss = result.nearestMiss;
    return {
        blocking_coordinate: miss === undefined ? null : miss.blockedBy.join(', '),
        nearest_principle_id: miss === undefined ? null : miss.principleId,
        nearest_is_same_page: miss === undefined ? null : miss.samePage,
    };
}

/** One result as a row. */
function rowFor(result: QuizResult, pageRefs: ReadonlyMap<string, string>): DecompositionRow {
    return {
        quiz_hand_id: result.quizId,
        page_ref: pageRefs.get(result.quizId) ?? null,
        outcome: outcomeFor(result.verdict),
        governing_principle_id: result.principleId ?? null,
        governing_specificity: result.governingSpecificity ?? null,
        candidate_count: result.candidateCount,
        runner_up_id: result.runnerUpId ?? null,
        runner_up_would_have_answered: runnerUpAnswer(result),
        expected_action: actionOf(result.expected),
        expected_sizing: sizingOf(result.expected),
        actual_action: actionOf(result.actual),
        actual_sizing: sizingOf(result.actual),
        ...missColumns(result),
        ...labelColumns(result),
    };
}

/**
 * One row per SCORED hand. Indeterminate hands have nothing to be right about,
 * and count hands are not in the rate (see `HarnessReport.counts`), so they are
 * not in these rows either: every figure `aggregate` draws from them would
 * otherwise mix an arithmetic check into the fidelity measure.
 */
export function decompose(report: HarnessReport, payload: OntologyPayload): DecompositionRow[] {
    // A page reference may be written as a number (`123`) or a span (`123-124`),
    // so it is stringified here rather than in every consumer.
    const pageRefs = new Map<string, string>(
        (payload.quiz_hands ?? [])
            .filter((quiz) => quiz.page_ref !== undefined)
            .map((quiz) => [quiz.id, String(quiz.page_ref)]),
    );
    return report.results
        .filter((result) => result.verdict !== 'indeterminate' && result.answerKind !== 'count')
        .map((result) => rowFor(result, pageRefs));
}

export interface Aggregates {
    /**
     * Correct divided by MATCHED. The encoding-fidelity figure.
     *
     * Headline this rather than the pass rate. The pass rate divides by every
     * scored hand, so it conflates "do the rules say what the source says" with
     * "are there enough rules", and it moves when either changes. Accuracy on
     * matched hands answers only the first.
     */
    readonly accuracyOnMatched: number;
    readonly matched: number;
    readonly correct: number;
    readonly unmatched: number;

    /**
     * Distinct principles producing failures, worst first.
     *
     * Four or fewer is a work list. A dozen or more says the problem is
     * systemic and the answer is re-encoding rather than patching.
     */
    readonly failureConcentration: readonly { principleId: string; failures: number }[];
    readonly distinctFailingPrinciples: number;

    /** Governing specificity -> how many hands it governed. */
    readonly specificityDistribution: readonly { specificity: number; hands: number }[];
    readonly medianGoverningSpecificity: number;

    /**
     * How often the second-ranked principle would have said the same thing.
     *
     * High means arbitration is low-stakes. Low means it is load-bearing, and
     * the tie-breaks are deciding real answers rather than breaking ties
     * between rules that agreed anyway.
     */
    readonly runnerUpAgreementRate: number;
    readonly handsWithRunnerUp: number;
    readonly runnerUpAgreed: number;
}

function median(values: readonly number[]): number {
    const sorted = [...values].sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    const upper = sorted[mid];
    if (upper === undefined) return 0;
    const lower = sorted[mid - 1];
    return sorted.length % 2 === 0 && lower !== undefined ? (lower + upper) / 2 : upper;
}

/**
 * A row a principle actually governed.
 *
 * Narrowed rather than defaulted: a matched row always carries the width of the
 * principle that governed it, because `decompose` writes both from the same
 * result. Reading it as `governing_specificity ?? 0` would add a branch nothing
 * can reach and quietly count a phantom width-0 rule if the invariant ever
 * broke — the narrowing makes it a type error instead.
 */
type MatchedRow = DecompositionRow & { governing_specificity: number };

const isMatched = (row: DecompositionRow): row is MatchedRow =>
    row.outcome !== 'unmatched' && row.governing_specificity !== null;

/** Distinct principles producing failures, worst first. */
function failureConcentration(rows: readonly DecompositionRow[]): Aggregates['failureConcentration'] {
    const failures = new Map<string, number>();
    for (const row of rows) {
        if (row.outcome !== 'fail' || row.governing_principle_id === null) continue;
        failures.set(row.governing_principle_id, (failures.get(row.governing_principle_id) ?? 0) + 1);
    }
    return [...failures.entries()]
        .map(([principleId, count]) => ({ principleId, failures: count }))
        .sort((x, y) => y.failures - x.failures || x.principleId.localeCompare(y.principleId));
}

/** Governing specificity -> how many hands it governed, narrowest first. */
function specificityDistribution(matchedRows: readonly MatchedRow[]): Aggregates['specificityDistribution'] {
    const bySpecificity = new Map<number, number>();
    matchedRows.forEach((row) => {
        bySpecificity.set(row.governing_specificity, (bySpecificity.get(row.governing_specificity) ?? 0) + 1);
    });
    return [...bySpecificity.entries()]
        .map(([width, hands]) => ({ specificity: width, hands }))
        .sort((x, y) => x.specificity - y.specificity);
}

/** The governing answer as the runner-up key is spelt: its own key for a label, action:sizing otherwise. */
const governingAnswer = (row: DecompositionRow): string =>
    row.actual_answer ?? `${String(row.actual_action)}:${row.actual_sizing ?? 'unspecified'}`;

/** The headline figures over every scored row. */
export function aggregate(rows: readonly DecompositionRow[]): Aggregates {
    const matchedRows = rows.filter(isMatched);
    const correct = matchedRows.filter((row) => row.outcome === 'pass').length;
    const concentration = failureConcentration(rows);
    const withRunnerUp = rows.filter((row) => row.runner_up_would_have_answered !== null);
    const agreed = withRunnerUp.filter((row) => row.runner_up_would_have_answered === governingAnswer(row)).length;
    return {
        accuracyOnMatched: matchedRows.length === 0 ? 0 : correct / matchedRows.length,
        matched: matchedRows.length,
        correct,
        unmatched: rows.length - matchedRows.length,
        failureConcentration: concentration,
        distinctFailingPrinciples: concentration.length,
        specificityDistribution: specificityDistribution(matchedRows),
        medianGoverningSpecificity: median(matchedRows.map((row) => row.governing_specificity)),
        runnerUpAgreementRate: withRunnerUp.length === 0 ? 1 : agreed / withRunnerUp.length,
        handsWithRunnerUp: withRunnerUp.length,
        runnerUpAgreed: agreed,
    };
}
