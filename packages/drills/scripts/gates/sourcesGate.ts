/**
 * Runs the source's own quiz hands against its encoding.
 *
 * The classifiers decide what every generated spot means, and a refactor that
 * changes how a board is tagged silently changes which principle answers which
 * spot. The classifiers' own tests move with the change; quiz hands do not:
 * they are the source's stated answers, which makes them the independent check.
 *
 * Fails the build: an `active` source below its own threshold, and, at any
 * state, a perfect score on a corpus of meaningful size, which on a prose
 * source means something was fitted. Everything else is reported in full.
 */
import type { OntologyPayload } from '../../src/ontology/types.ts';
import { runHarness, scenarioFromQuizHand, missedCoordinates } from '../../src/harness/quizHarness.ts';
import { aggregate, decompose } from '../../src/harness/decompose.ts';
import { baseRates, claimVolume } from '../../src/harness/diagnostics.ts';
import { perfectScoreTrips } from '../../src/harness/perfectScore.ts';
import type { HarnessReport } from '../../src/harness/results.ts';
import { ruleOf } from './sampling.ts';
import { pct, say } from './output.ts';
import { stateSuppression } from './state.ts';
import { printCounts, printDiagnostics, printHeadline, type Measures } from './sourcesReport.ts';
import { writeSourceReports } from './sourcesFiles.ts';
import type { Gate } from './gate.ts';

/**
 * Drillable principles no hand in the corpus COULD exercise: no scored hand
 * states every coordinate the rule's situation reads. Distinct from untested,
 * this moves only when better-specified hands are transcribed.
 */
function unverifiablePrinciples(payload: OntologyPayload): string[] {
    const scenarios = (payload.quiz_hands ?? [])
        .filter((hand) => hand.indeterminate !== true)
        .flatMap((hand) => scenarioFromQuizHand(hand, payload) ?? []);
    return payload.principles
        .filter((principle) => principle.drillable !== false)
        .filter((principle) => !scenarios.some((scenario) =>
            missedCoordinates(scenario, ruleOf(principle).situation).every((miss) => !miss.endsWith('=UNSTATED'))))
        .map((principle) => principle.id);
}

function measuresFor(payload: OntologyPayload, result: HarnessReport): Measures {
    const rows = decompose(result, payload);
    const claims = claimVolume(payload);
    return {
        result,
        rows,
        totals: aggregate(rows),
        floors: baseRates(payload),
        claims,
        untested: claims.filter((entry) => entry.handsClaimed === 0).map((entry) => entry.principleId),
        unverifiable: unverifiablePrinciples(payload),
        drillableCount: payload.principles.filter((principle) => principle.drillable !== false).length,
    };
}

/** Perfection fails at any state; below threshold fails an active source only. */
function verdict(payload: OntologyPayload, measures: Measures): boolean {
    const { result, totals } = measures;
    const perfect = perfectScoreTrips({
        passRate: result.passRate, scored: result.scored, accuracyOnMatched: totals.accuracyOnMatched, matched: totals.matched,
    });
    if (perfect.length > 0) {
        say(`  FAILS THE BUILD at any state: ${perfect.join('; ')}.`);
        say('  Perfect fidelity to a prose source means something was fitted, or every matched hand is in-sample.');
        say('  Add hands the encoding can miss, written after the rules were frozen.');
        return false;
    }
    if (result.meetsThreshold) return true;
    const suppression = stateSuppression(payload.source, 'sources');
    if (!suppression.suppress) {
        say(`  FAILS THE BUILD: the source is active and below its own threshold (${pct(result.passRate)} < ${pct(result.threshold)}).`);
        return false;
    }
    suppression.lines.forEach((line) => say(line));
    say('  Set state to "active" once it clears its threshold.');
    return true;
}

export const sourcesGate: Gate = {
    name: 'sources',
    run(run) {
        const payload = run.source.payload;
        const result = runHarness(payload);
        printCounts(result);
        if (result.scored === 0) {
            say('  no scored quiz hands: encoding fidelity is unchecked for this source.');
            return true;
        }
        const measures = measuresFor(payload, result);
        printHeadline(measures);
        printDiagnostics(payload, measures);
        if (run.reports !== null) writeSourceReports(run.reports, run.source, measures);
        return verdict(payload, measures);
    },
};
