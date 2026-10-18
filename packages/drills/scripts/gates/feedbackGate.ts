/**
 * Does every mistake a reader can make get the source's own explanation?
 *
 * `FEEDBACK_NO_ERROR_KEY` asks for only one error key, so a principle can pass
 * the validator and still answer most mistakes with the engine's filler.
 * "Reachable" is computed rather than assumed: generate spots the way the app
 * does, ask the pad what a reader could have pressed, and classify each of those
 * against what the source says. The result is exactly the set of error classes
 * a principle can produce (usually one to three), so the requirement is precise
 * instead of "author everything".
 */
import type { Principle, SizingBucket } from '../../src/ontology/types.ts';
import type { Scenario } from '../../src/generator/types.ts';
import { resolveOutcome } from '../../src/grading/resolve.ts';
import { classifyError, legalActions } from '../../src/grading/classifyError.ts';
import { PAD_SIZINGS } from '../../src/grading/pad.ts';
import { samplerFor, spotsFor, type Sampler } from './sampling.ts';
import { say } from './output.ts';
import { verdictForFindings, type Gate } from './gate.ts';

const SEEDS = { count: 25, seedOf: (n: number): number => n * 104729 + 11 };

interface FeedbackRow {
    readonly id: string;
    readonly pageRef: string;
    readonly missing: readonly string[];
}

/** The wrong-answer classes a reader can reach on one spot, pressing every button the pad offers. */
function reachableOn(sampler: Sampler, principle: Principle, scenario: Scenario): string[] {
    const resolution = resolveOutcome(principle, scenario, sampler.context);
    if (resolution === null) return [];
    return legalActions(scenario).flatMap((action) => {
        const sizes: readonly (SizingBucket | undefined)[] = action === 'bet' || action === 'raise' ? PAD_SIZINGS : [undefined];
        return sizes.flatMap((sizing) => {
            const grade = classifyError({ action, sizing }, resolution, scenario, principle);
            return grade.correct ? [] : [grade.klass];
        });
    });
}

/** Error keys the principle has written something for. */
const authoredKeys = (principle: Principle): Set<string> => new Set(
    Object.entries(principle.feedback)
        .filter(([key, text]) => key !== 'correct' && typeof text === 'string' && text.trim() !== '')
        .map(([key]) => key),
);

function measure(sampler: Sampler, principle: Principle): FeedbackRow {
    const reachable = new Set(spotsFor(sampler, principle, SEEDS).flatMap((s) => reachableOn(sampler, principle, s)));
    const authored = authoredKeys(principle);
    return {
        id: principle.id,
        pageRef: String(principle.page_ref ?? '—'),
        missing: [...reachable].filter((klass) => !authored.has(klass)).sort(),
    };
}

export const feedbackGate: Gate = {
    name: 'feedback',
    run(run) {
        const sampler = samplerFor(run.source.payload);
        const rows = sampler.drillable.map((principle) => measure(sampler, principle));
        const incomplete = rows.filter((row) => row.missing.length > 0);
        const missing = incomplete.reduce((total, row) => total + row.missing.length, 0);
        say(`feedback completeness — ${rows.length} drillable principles`);
        say(`  complete:   ${rows.length - incomplete.length}`);
        say(`  incomplete: ${incomplete.length}`);
        incomplete.forEach((row) => say(`  ${row.id.padEnd(36)} ref ${row.pageRef.padEnd(10)} missing: ${row.missing.join(', ')}`));
        if (missing === 0) {
            say('Every mistake a reader can make is answered in the source\'s own words.');
            return true;
        }
        say(`${missing} mistake(s) a reader can make would get the engine's filler, not the source's explanation.`);
        return verdictForFindings(run, 'feedback');
    },
};
