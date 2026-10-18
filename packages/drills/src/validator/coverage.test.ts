import { describe, it, expect, beforeEach } from 'vitest';
import { validateSource, CODES, ERROR_FEEDBACK_KEYS, isError } from './index.ts';
import { stage6Coverage } from './stage6.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

const counts = (count: number) => new Map([['pr_1', count]]);

describe('stage 6: feedback for every mistake', () => {
    it('passes a principle that answers every mistake it can produce', () => {
        expect(stage6Coverage({ payload: payload({ quiz_hands: [] }), scenarioCounts: counts(100) })
            .filter(isError)).toEqual([]);
    });

    /**
     * One error key used to be enough, and most principles in a real encoding
     * passed on that basis while leaving a mistake the reader could actually
     * make answered by the engine's own filler.
     *
     * What makes the requirement fair is that the set is DERIVED: this rule
     * raises in-range and folds out of it, so being too loose, too tight, too
     * passive and wrong about the size are all reachable — and nothing else is.
     * It is never a demand for all six.
     */
    it('names each mistake the rule can produce and has no answer for', () => {
        const thin = payload({
            principles: [principle({ feedback: { correct: 'Right.', too_loose: 'Too wide.' } })],
        });
        const findings = stage6Coverage({ payload: thin, scenarioCounts: counts(100) })
            .filter((finding) => finding.code === CODES.FEEDBACK_UNREACHED_ERROR);

        expect(findings.map((finding) => finding.path.split('/').pop()).sort())
            .toEqual(['too_passive', 'too_tight', 'wrong_sizing']);
        // Not `right_idea_wrong_spot`: it depends on which branch fired, so it
        // is not a property of an outcome and stays optional.
        expect(findings.map((finding) => finding.path)).not.toContain('right_idea_wrong_spot');
    });

    it('asks nothing of a principle that is not drilled', () => {
        const concept = payload({
            principles: [principle({ drillable: false, feedback: { correct: 'Right.' } })],
        });
        expect(codes(stage6Coverage({ payload: concept, scenarioCounts: counts(100) })))
            .not.toContain(CODES.FEEDBACK_UNREACHED_ERROR);
    });

    it('rejects a principle that can only ever say "correct"', () => {
        const bare = payload({ principles: [principle({ feedback: { correct: 'Right.' } })] });
        expect(codes(stage6Coverage({ payload: bare, scenarioCounts: counts(100) })))
            .toContain(CODES.FEEDBACK_NO_ERROR_KEY);
    });

    it('rejects empty feedback text, not just a missing key', () => {
        const blank = payload({
            principles: [principle({ feedback: { correct: '   ', too_loose: '  ' } })],
        });
        const findings = codes(stage6Coverage({ payload: blank, scenarioCounts: counts(100) }));
        expect(findings).toContain(CODES.FEEDBACK_EMPTY);
        expect(findings).toContain(CODES.FEEDBACK_NO_ERROR_KEY);
    });

    it('accepts any one of the error keys as "the author said something"', () => {
        ERROR_FEEDBACK_KEYS.forEach((key) => {
            const one = payload({
                principles: [principle({ feedback: { correct: 'Right.', [key]: 'Wrong.' } })],
            });
            expect(codes(stage6Coverage({ payload: one, scenarioCounts: counts(100) })))
                .not.toContain(CODES.FEEDBACK_NO_ERROR_KEY);
        });
    });
});

describe('stage 6: a reason for every right answer', () => {
    it('requires its own "correct" on every outcome of a rule whose outcomes differ in action', () => {
        // One sentence written for the raise once praised a reader who
        // correctly folded for raising: one reason cannot serve two answers.
        const sides = payload({ principles: [principle({
            rule: {
                kind: 'range_lookup', situation: { street: 'preflop', hero_position: ['BTN'] }, range_set_id: 'rs_1',
                in_range: { action: 'raise', sizing: 'medium', feedback: { correct: 'On the list.' } },
                out_of_range: { action: 'fold' },
            },
        })] });
        const found = stage6Coverage({ payload: sides, scenarioCounts: counts(100) })
            .filter((finding) => finding.code === CODES.FEEDBACK_SIDE_AMBIGUOUS);
        expect(found.map((finding) => finding.path)).toEqual(['/principles/0/rule/out_of_range']);
        expect(found[0]?.severity).toBe('error');

        // Branches, defaults and exceptions all count as outcomes.
        const branched = payload({ principles: [principle({
            rule: {
                kind: 'predicate', situation: { street: 'flop' },
                branches: [{ when: { hand_class_any: ['no_pair'] }, then: { action: 'check' } }],
                default: { action: 'bet', sizing: 'medium', feedback: { correct: 'Bet it.' } },
            },
            exceptions: [{ when: { board_require: ['monotone'] }, then: { action: 'bet', sizing: 'large' } }],
        })] });
        expect(stage6Coverage({ payload: branched, scenarioCounts: counts(100) })
            .filter((finding) => finding.code === CODES.FEEDBACK_SIDE_AMBIGUOUS)
            .map((finding) => finding.path).sort())
            .toEqual(['/principles/0/exceptions/0/then', '/principles/0/rule/branches/0/then']);
    });

    it('asks nothing extra of a rule with one answer, or of a concept', () => {
        const oneAnswer = payload({ principles: [principle({
            rule: {
                kind: 'predicate', situation: { street: 'flop' },
                branches: [{ when: { hand_class_any: ['no_pair'] }, then: { action: 'bet', sizing: 'small' } }],
                default: { action: 'bet', sizing: 'medium' },
            },
        })] });
        expect(codes(stage6Coverage({ payload: oneAnswer, scenarioCounts: counts(100) })))
            .not.toContain(CODES.FEEDBACK_SIDE_AMBIGUOUS);
        const concept = payload({ principles: [principle({
            drillable: false,
            rule: {
                kind: 'range_lookup', situation: { street: 'preflop' }, range_set_id: 'rs_1',
                in_range: { action: 'raise' }, out_of_range: { action: 'fold' },
            },
        })] });
        expect(codes(stage6Coverage({ payload: concept, scenarioCounts: counts(100) })))
            .not.toContain(CODES.FEEDBACK_SIDE_AMBIGUOUS);
        // A one-sided range rule abstains on the other side — one answer.
        const oneSided = payload({ principles: [principle({
            rule: { kind: 'range_lookup', situation: { street: 'preflop' }, range_set_id: 'rs_1', in_range: { action: 'raise' } },
        })] });
        expect(codes(stage6Coverage({ payload: oneSided, scenarioCounts: counts(100) })))
            .not.toContain(CODES.FEEDBACK_SIDE_AMBIGUOUS);
    });
});

describe('stage 6: room to vary', () => {
    it('warns that a narrow principle will start repeating', () => {
        const findings = stage6Coverage({ payload: payload(), scenarioCounts: counts(3) });
        const thin = findings.find((finding) => finding.code === CODES.THIN_ENCODING);
        expect(thin?.severity).toBe('warning');
        expect(thin?.witness).toBe(3);
    });

    it('does not warn about a principle with room to vary', () => {
        expect(codes(stage6Coverage({ payload: payload(), scenarioCounts: counts(500) })))
            .not.toContain(CODES.THIN_ENCODING);
    });

    it('notes the absence of quiz hands without failing the import', () => {
        const findings = stage6Coverage({ payload: payload(), scenarioCounts: counts(500) });
        const note = findings.find((finding) => finding.code === CODES.NO_QUIZ_HANDS);
        expect(note?.severity).toBe('info');
    });
});

describe('stage 6 and a range lookup with no sides (ontology 1.5)', () => {
    it('refuses a range rule that omits both sides, which could never answer', () => {
        const silent = payload({
            principles: [principle({
                rule: { kind: 'range_lookup', situation: { street: 'preflop' }, range_set_id: 'rs_1' },
            })],
        });
        expect(validateSource(silent).findings.map((f) => f.code))
            .toContain(CODES.RULE_NEVER_ANSWERS);
    });

    it('accepts a range rule with one side, which abstains on the other', () => {
        // The 1.5 contract: an omitted side declines the spot rather than
        // inventing an answer the source never gave.
        const oneSided = payload({
            principles: [principle({
                rule: {
                    kind: 'range_lookup',
                    situation: { street: 'preflop' },
                    range_set_id: 'rs_1',
                    out_of_range: { action: 'fold' },
                },
            })],
        });
        expect(validateSource(oneSided).findings.map((f) => f.code))
            .not.toContain(CODES.RULE_NEVER_ANSWERS);
    });
});
