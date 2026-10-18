import { describe, it, expect } from 'vitest';
import type { OntologyPayload, Principle, QuizHand } from '../ontology/types.ts';
import { runHarness } from './quizHarness.ts';
import { clopperPearson } from './interval.ts';

/**
 * Provenance (1.8): the harness reports what a hand's pass can MEAN.
 *
 * Synthetic fixtures, as in quizHarness.test.ts — the mechanism under test is
 * bookkeeping, not poker. One always-bet flop rule; hands that match it and
 * agree, match it and disagree, or state no cards and so match nothing.
 */

const principle: Principle = {
    id: 'pr_always_bet',
    source_id: 'src',
    name: 'Always bet',
    rule: {
        kind: 'predicate',
        situation: { street: 'flop' },
        branches: [],
        default: { action: 'bet', sizing: 'medium' },
    },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', too_loose: 'x' },
};

const hand = (id: string, over: Partial<QuizHand> = {}): QuizHand => ({
    id,
    source_id: 'src',
    situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d'] },
    author_answer: { action: 'bet', sizing: 'medium' },
    ...over,
});

const payload = (quiz_hands: QuizHand[]): OntologyPayload => ({
    ontology_version: '1.8',
    source: { id: 'src', title: 'Fixture', kind: 'personal_notes', quiz_pass_threshold: 0.5 },
    opponent_types: [],
    range_sets: [],
    principles: [principle],
    quiz_hands,
});

describe('reporting provenance', () => {
    it('has no out-of-sample figure when no hand declares one', () => {
        const report = runHarness(payload([hand('q1'), hand('q2', { author_answer: { action: 'check' } })]));
        expect(report.outOfSample).toBeNull();
        expect(report.byProvenance).toEqual([{ kind: 'unstated', form: 'unstated', scored: 2, matched: 2, passed: 1 }]);
        expect(report.results.every((result) => result.provenance === undefined)).toBe(true);
    });

    it('treats a worked example as in-sample, not as out-of-sample under another name', () => {
        const report = runHarness(payload([
            hand('q1', { provenance: { kind: 'worked_example', form: 'literal' } }),
        ]));
        expect(report.outOfSample).toBeNull();
        expect(report.byProvenance).toEqual([{ kind: 'worked_example', form: 'literal', scored: 1, matched: 1, passed: 1 }]);
        expect(report.results[0]?.provenance).toEqual({ kind: 'worked_example', form: 'literal' });
    });

    it('pools probe and held-out hands, splits them by form, and puts an interval on matched accuracy', () => {
        const report = runHarness(payload([
            hand('worked', { provenance: { kind: 'worked_example', form: 'literal' } }),
            hand('probe_pass', { provenance: { kind: 'probe', form: 'literal' } }),
            hand('probe_fail', { provenance: { kind: 'probe', form: 'instantiated' }, author_answer: { action: 'check' } }),
            hand('held_pass', { provenance: { kind: 'held_out', form: 'instantiated' } }),
            // No cards stated: unusable, so unmatched — in the denominator, not in the interval.
            hand('held_hole', { provenance: { kind: 'held_out', form: 'literal' }, situation_instance: {} }),
            hand('unstated'),
        ]));

        expect(report.outOfSample).toEqual({
            scored: 4,
            matched: 3,
            passed: 2,
            interval: clopperPearson(2, 3),
            literal: { scored: 2, matched: 1, passed: 1 },
            instantiated: { scored: 2, matched: 2, passed: 1 },
        });
        expect(report.byProvenance).toEqual([
            { kind: 'worked_example', form: 'literal', scored: 1, matched: 1, passed: 1 },
            { kind: 'probe', form: 'literal', scored: 1, matched: 1, passed: 1 },
            { kind: 'probe', form: 'instantiated', scored: 1, matched: 1, passed: 0 },
            { kind: 'held_out', form: 'literal', scored: 1, matched: 0, passed: 0 },
            { kind: 'held_out', form: 'instantiated', scored: 1, matched: 1, passed: 1 },
            { kind: 'unstated', form: 'unstated', scored: 1, matched: 1, passed: 1 },
        ]);
        // The raw rate still counts every scored hand, in-sample or not.
        expect(report.scored).toBe(6);
        expect(report.passed).toBe(4);
    });

    it('has no interval until a rule has claimed an out-of-sample hand', () => {
        const report = runHarness(payload([
            hand('held_hole', { provenance: { kind: 'held_out', form: 'literal' }, situation_instance: {} }),
        ]));
        expect(report.outOfSample).toEqual({
            scored: 1,
            matched: 0,
            passed: 0,
            interval: null,
            literal: { scored: 1, matched: 0, passed: 0 },
            instantiated: { scored: 0, matched: 0, passed: 0 },
        });
    });

    it('keeps an indeterminate hand out of every bucket but carries its provenance on the result', () => {
        const { author_answer: _unanswered, ...open } = hand('open', {
            provenance: { kind: 'held_out', form: 'literal' },
            indeterminate: true,
            indeterminate_reason: 'The source presents two lines as equally good and picks neither.',
        });
        const report = runHarness(payload([open, hand('scored', { provenance: { kind: 'probe', form: 'literal' } })]));
        expect(report.results[0]?.verdict).toBe('indeterminate');
        expect(report.results[0]?.provenance).toEqual({ kind: 'held_out', form: 'literal' });
        expect(report.outOfSample?.scored).toBe(1);
        expect(report.byProvenance).toEqual([{ kind: 'probe', form: 'literal', scored: 1, matched: 1, passed: 1 }]);
    });
});
