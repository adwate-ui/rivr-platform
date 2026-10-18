/**
 * The harness's totals: by provenance, out of sample, and for count hands.
 */
import type { ProvenanceForm, ProvenanceKind } from '../ontology/types.ts';
import { PROVENANCE_FORMS, PROVENANCE_KINDS } from '../ontology/types.ts';
import { clopperPearson } from './interval.ts';
import {
    isMatched, type CountTally, type OutOfSample, type ProvenanceBucket, type QuizResult, type Tally,
} from './results.ts';

const OUT_OF_SAMPLE_KINDS: ReadonlySet<ProvenanceKind> = new Set(['probe', 'held_out']);

const isOutOfSample = (result: QuizResult): boolean =>
    result.provenance !== undefined && OUT_OF_SAMPLE_KINDS.has(result.provenance.kind);

const isPass = (result: QuizResult): boolean => result.verdict === 'pass';

const tally = (results: readonly QuizResult[]): Tally => ({
    scored: results.length,
    matched: results.filter(isMatched).length,
    passed: results.filter(isPass).length,
});

/** The count line: every count hand, and the out-of-sample ones apart. */
export function countTally(counted: readonly QuizResult[]): CountTally | null {
    if (counted.length === 0) return null;
    const tallied = (results: readonly QuizResult[]) => ({
        scored: results.length,
        matched: results.filter(isMatched).length,
        reproduced: results.filter(isPass).length,
    });
    const outside = counted.filter(isOutOfSample);
    return { ...tallied(counted), outOfSample: outside.length === 0 ? null : tallied(outside) };
}

/** Scored hands grouped by declared provenance, in schema order, unstated last. */
export function provenanceBuckets(scored: readonly QuizResult[]): ProvenanceBucket[] {
    const kinds: (ProvenanceKind | 'unstated')[] = [...PROVENANCE_KINDS, 'unstated'];
    const forms: (ProvenanceForm | 'unstated')[] = [...PROVENANCE_FORMS, 'unstated'];
    return kinds.flatMap((kind) => forms.flatMap((form) => {
        const members = scored.filter((result) =>
            (result.provenance?.kind ?? 'unstated') === kind && (result.provenance?.form ?? 'unstated') === form);
        return members.length > 0 ? [{ kind, form, ...tally(members) }] : [];
    }));
}

/**
 * Probe and held-out hands pooled, with the literal and instantiated split.
 *
 * Null when no scored hand declares one of those kinds: a source without
 * out-of-sample hands has no out-of-sample number, and printing one from worked
 * examples would be the in-sample figure under a better name.
 */
export function outOfSampleOf(scored: readonly QuizResult[]): OutOfSample | null {
    const pooled = scored.filter(isOutOfSample);
    if (pooled.length === 0) return null;
    const totals = tally(pooled);
    return {
        ...totals,
        interval: totals.matched === 0 ? null : clopperPearson(totals.passed, totals.matched),
        literal: tally(pooled.filter((result) => result.provenance?.form === 'literal')),
        instantiated: tally(pooled.filter((result) => result.provenance?.form === 'instantiated')),
    };
}
