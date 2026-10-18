/**
 * What the sources gate prints: the headline against its floors, then the
 * diagnostics that say where to look.
 */
import type { OntologyPayload } from '../../src/ontology/types.ts';
import type { HarnessReport, Tally } from '../../src/harness/results.ts';
import type { Aggregates, DecompositionRow } from '../../src/harness/decompose.ts';
import { bucketCounts, separation, triage, type BaseRates, type ClaimVolume } from '../../src/harness/diagnostics.ts';
import { pct, say, share, table } from './output.ts';

export interface Measures {
    readonly result: HarnessReport;
    readonly rows: readonly DecompositionRow[];
    readonly totals: Aggregates;
    readonly floors: BaseRates;
    readonly claims: readonly ClaimVolume[];
    /** Drillable principles no scored hand exercises. */
    readonly untested: readonly string[];
    /** Drillable principles no hand in the corpus could exercise. */
    readonly unverifiable: readonly string[];
    readonly drillableCount: number;
}

const tallied = (tally: Tally): string => `${tally.passed}/${tally.matched} matched of ${tally.scored}`;

/** Count hands first: they check the range and the arithmetic, not the rules, so they are in no rate. */
export function printCounts(result: HarnessReport): void {
    if (result.counts === null) return;
    const c = result.counts;
    say(`  COUNTS REPRODUCED          ${c.reproduced}/${c.matched} matched of ${c.scored} count hand(s)`);
    result.results
        .filter((hand) => hand.answerKind === 'count' && hand.verdict !== 'pass' && hand.verdict !== 'indeterminate')
        .forEach((hand) => say(`    ${hand.verdict.toUpperCase()} ${hand.quizId}: source ${hand.expectedKey}, engine ${hand.actualKey ?? '—'}`));
}

/** Accuracy on matched hands is the figure to track; the raw rate mixes fidelity with coverage. */
export function printHeadline(measures: Measures): void {
    const { result, totals } = measures;
    say(`  ACCURACY ON MATCHED HANDS  ${pct(totals.accuracyOnMatched)} (${totals.correct}/${totals.matched})`);
    say(`  raw pass rate              ${pct(result.passRate)} (${result.passed}/${result.scored}), threshold ${pct(result.threshold)}`);
    say(`    ${totals.unmatched} scored hand(s) nothing covers; they lower the raw rate, not the accuracy.`);
    if (result.outOfSample !== null) {
        const oos = result.outOfSample;
        const interval = oos.interval === null ? 'no matched hand yet' : `95% [${pct(oos.interval[0])}, ${pct(oos.interval[1])}]`;
        say(`  OUT-OF-SAMPLE              ${tallied(oos)} (probe + held_out), ${interval}`);
        say(`    literal ${tallied(oos.literal)} · instantiated ${tallied(oos.instantiated)}`);
    }
    say(`  UNTESTED PRINCIPLES        ${measures.untested.length}/${measures.claims.length} (${share(measures.untested.length, measures.claims.length)})`);
    say(`  UNVERIFIABLE PRINCIPLES    ${measures.unverifiable.length}/${measures.drillableCount} (${share(measures.unverifiable.length, measures.drillableCount)})`);
}

function printFloors(floors: BaseRates, passRate: number): void {
    say(floors.modalAction === null
        ? '  modal-action base rate     —  no hand is answered with an action'
        : `  modal-action base rate     ${pct(floors.modalActionRate)}  (always answering "${floors.modalAction}")`);
    say(`  uniform-random floor       ${pct(floors.uniformRandomFloor)}  (${pct(floors.uniformRandomFloorAnswerable)} over answerable hands)`);
    if (passRate <= floors.modalActionRate) say('    NOTE: the pass rate does not beat a rule that always gives the commonest answer.');
    floors.unexpressibleAnswers.forEach(({ quizId, action }) =>
        say(`    UNPASSABLE ${quizId}: answers "${action}", which the pad never offers`));
    floors.contradictoryAnswers.forEach(({ quizId, action, facingState }) =>
        say(`    UNPASSABLE ${quizId}: records "${facingState}" and answers "${action}"; fix the action log, not a rule`));
}

function printConcentration(totals: Aggregates): void {
    say('  failure concentration:');
    if (totals.distinctFailingPrinciples === 0) {
        say('    no principle produced a wrong answer.');
        return;
    }
    totals.failureConcentration.forEach(({ principleId, failures }) => say(`    ${String(failures).padStart(3)}  ${principleId}`));
    const n = totals.distinctFailingPrinciples;
    if (n <= 4) say(`    ${n} distinct principle(s): concentrated, so this is a work list.`);
    else if (n < 12) say(`    ${n} distinct principles: fix the top two and re-measure.`);
    else say(`    ${n} distinct principles: systemic; the answer is re-encoding, not patching.`);
}

function printTriage(payload: OntologyPayload, result: HarnessReport): void {
    const triaged = triage(result, payload);
    say('  failure triage:');
    if (triaged.length === 0) {
        say('    nothing to triage.');
        return;
    }
    bucketCounts(triaged).forEach(({ bucket, failures }) => say(`    ${String(failures).padStart(3)}  ${bucket}`));
    say(table(triaged.map((entry) => ({
        hand: entry.quizId, bucket: entry.bucket, governing: entry.governingPrincipleId, w: entry.governingWidth,
        'had it right': entry.correctCandidateId, ignored: entry.unconstrainedButStated.length,
    })), ['hand', 'bucket', 'governing', 'w', 'had it right', 'ignored']));
}

function printSeparation(payload: OntologyPayload, result: HarnessReport): void {
    say('  what separates a rule\'s right answers from its wrong ones:');
    for (const entry of separation(result, payload)) {
        say(`    ${entry.principleId}: governs ${entry.governed}, ${entry.passed} right / ${entry.failed} wrong`);
        entry.separators.forEach(({ slot, onPasses, onFailures }) =>
            say(`      ${slot}: right on [${onPasses.join(', ')}], wrong on [${onFailures.join(', ')}]`));
    }
}

function printRunnerUp(totals: Aggregates): void {
    say(`  runner-up agreement: ${pct(totals.runnerUpAgreementRate)} (${totals.runnerUpAgreed}/${totals.handsWithRunnerUp})`);
    say(totals.runnerUpAgreementRate >= 0.8
        ? '    high: the ranking rarely changes the answer.'
        : '    low: arbitration is load-bearing; a change to the ranking would change what the source appears to say.');
}

function printRows(rows: readonly DecompositionRow[]): void {
    const action = (act: string | null, size: string | null): string | null => (act === null ? null : `${act}:${size ?? 'unspecified'}`);
    say('  every scored hand:');
    say(table(rows.map((row) => ({
        hand: row.quiz_hand_id, ref: row.page_ref, outcome: row.outcome, governing: row.governing_principle_id,
        w: row.governing_specificity, cands: row.candidate_count, 'runner-up': row.runner_up_id,
        expected: action(row.expected_action, row.expected_sizing), actual: action(row.actual_action, row.actual_sizing),
        blocked: row.blocking_coordinate, nearest: row.nearest_principle_id,
    })), ['hand', 'ref', 'outcome', 'governing', 'w', 'cands', 'runner-up', 'expected', 'actual', 'blocked', 'nearest']));
}

/** Everything after the headline: floors, where failures concentrate, and the per-hand table. */
export function printDiagnostics(payload: OntologyPayload, measures: Measures): void {
    printFloors(measures.floors, measures.result.passRate);
    printConcentration(measures.totals);
    say(`  median governing specificity ${measures.totals.medianGoverningSpecificity}; a low median means the encoding is under-constrained.`);
    printTriage(payload, measures.result);
    printSeparation(payload, measures.result);
    say('  highest claim volume (a high count against a low width is the risk profile):');
    say(table(measures.claims.slice(0, 10).map((entry) => ({
        principle: entry.principleId, claimed: entry.handsClaimed, governed: entry.handsGoverned, width: entry.width,
    })), ['principle', 'claimed', 'governed', 'width']));
    printRunnerUp(measures.totals);
    printRows(measures.rows);
}
