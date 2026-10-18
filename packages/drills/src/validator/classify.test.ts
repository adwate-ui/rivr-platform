import { describe, it, expect, beforeEach } from 'vitest';
import type { AuthorAnswer, ClassifyRule, Principle, QuizHand } from '../ontology/types.ts';
import { validateSource, CODES, isError } from './index.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload, principle } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

const LABELS = [{ id: 'hit_hard', label: 'Hit hard' }, { id: 'missed', label: 'Missed' }];

/** A classify rule over the two invented labels; branches and default are the caller's to change. */
const classifyRule = (over: Partial<ClassifyRule> = {}): ClassifyRule => ({
    kind: 'classify',
    situation: { street: ['flop'] },
    labels: LABELS,
    perspective: 'hero',
    prompt: 'Did this flop hit the range hard, or miss it?',
    branches: [{ when: { hero_position: ['BTN'] }, then: { label: 'hit_hard' } }],
    default: { label: 'missed' },
    ...over,
});

const labelled = (over: Partial<Principle> = {}): Principle => ({
    id: 'pr_hit',
    source_id: 'src_test',
    name: 'Hit or miss',
    rule: classifyRule(),
    rationale: 'Because.',
    feedback: { correct: 'Right.', wrong_label: 'The source reads it the other way.' },
    ...over,
});

const findingsFor = (principles: Principle[]) => validateSource(payload({ ontology_version: '1.9', principles })).findings;

describe('a rule that answers with a label (ontology 1.9)', () => {
    /*
     * Stage 6 asks every outcome of a multi-answer rule to say, in its own
     * words, why it is right, because one `correct` written for one answer
     * cannot explain another. That check walks ACTION outcomes, and a classify
     * rule has none: its answers are labels, and what a wrong one deserves to
     * be told is `wrong_label`.
     *
     * The failure this guards against is the check reading `outcome.action` off
     * a label and reporting a missing-feedback error nobody can act on.
     */
    it('validates without being asked for action feedback it has no actions for', () => {
        const findings = findingsFor([labelled()]);
        expect(codes(findings).filter((code) => code.includes('FEEDBACK'))).toEqual([]);
        expect(findings.filter((finding) => finding.severity === 'error')).toEqual([]);
    });

    it('refuses a branch that answers with a label the rule does not offer', () => {
        // JSON Schema cannot say "one of the values in a sibling array", so a
        // typo here validates cleanly and then grades every reader wrong for as
        // long as the source ships.
        const typo = labelled({
            rule: classifyRule({ branches: [{ when: { hero_position: ['BTN'] }, then: { label: 'hit_hardd' } }] }),
        });
        const findings = findingsFor([typo]);
        expect(codes(findings)).toContain(CODES.UNKNOWN_LABEL);
        expect(findings.find((finding) => finding.code === CODES.UNKNOWN_LABEL)?.message).toContain('hit_hard');
    });

    it('refuses a default that answers with a label the rule does not offer', () => {
        const typo = labelled({ rule: classifyRule({ default: { label: 'nonsense' } }) });
        expect(codes(findingsFor([typo]))).toContain(CODES.UNKNOWN_LABEL);
    });

    it.each(['exceptions', 'modifiers'] as const)(
        'refuses %s on a classify rule rather than ignoring them',
        (field) => {
            // `resolveClassify` does not read either. Silently ignoring an
            // authored field is worse than refusing it: the encoder believes
            // they have written a rule they have not.
            const withField = field === 'exceptions'
                ? labelled({ exceptions: [{ when: { street: ['flop'] }, then: { action: 'bet' } }] })
                : labelled({ modifiers: [{ id: 'm1', when: {}, effect: { substitute_outcome: { action: 'bet' } } }] });
            expect(codes(findingsFor([withField]))).toContain(CODES.ANSWER_KIND_MISMATCH);
        },
    );

    it('refuses an override that changes what kind of question is being asked', () => {
        const swapped = labelled({
            rule: { kind: 'predicate', situation: { street: ['flop'] }, branches: [], default: { action: 'bet' } },
            override_rule: classifyRule(),
        });
        expect(codes(findingsFor([swapped]))).toContain(CODES.ANSWER_KIND_MISMATCH);
    });

    it('still catches a classify rule that can never answer anything', () => {
        const { default: _default, ...withoutDefault } = classifyRule({ branches: [] });
        expect(codes(findingsFor([labelled({ rule: withoutDefault })]))).toContain(CODES.RULE_NEVER_ANSWERS);
    });
});

describe('a quiz hand the author answered with a label', () => {
    /*
     * A label is checked against the labels the source's classify rules
     * actually offer, because a misspelt one would otherwise score as a silent
     * fail against a rule that was right all along.
     */
    const villainRule = classifyRule({ perspective: 'villain', branches: [] });
    const hit = (over: Partial<Principle> = {}): Principle => labelled({ rule: villainRule, ...over });
    const quiz = (author_answer: AuthorAnswer): QuizHand => ({
        id: 'q1',
        source_id: 'src_test',
        situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qh', '8c', '3d'] },
        author_answer,
    });
    const labelFindings = (principles: Principle[], label: string) => validateSource(payload({
        ontology_version: '2.0',
        principles,
        quiz_hands: [quiz({ kind: 'classify', label })],
    })).findings;

    it('accepts a label one of the source\'s rules offers', () => {
        const findings = labelFindings([principle(), hit()], 'missed');
        expect(codes(findings)).not.toContain(CODES.UNKNOWN_LABEL);
        expect(findings.filter(isError)).toEqual([]);
    });

    it('refuses a label no rule offers, and says which ones do', () => {
        const unknown = labelFindings([principle(), hit()], 'hit_hardd')
            .find((finding) => finding.code === CODES.UNKNOWN_LABEL);
        expect(unknown?.path).toBe('/quiz_hands/0/author_answer/label');
        expect(unknown?.message).toContain('(hit_hard, missed)');
    });

    it('says so when the source has no classify rule at all', () => {
        expect(labelFindings([principle()], 'hit_hard').find((finding) => finding.code === CODES.UNKNOWN_LABEL)?.message)
            .toContain('(it has none)');
    });

    it('counts a label an override offers as offered', () => {
        const overridden = hit({
            id: 'pr_other',
            rule: principle().rule,
            status: 'overridden',
            override_rule: villainRule,
        });
        expect(codes(labelFindings([principle(), overridden], 'hit_hard'))).not.toContain(CODES.UNKNOWN_LABEL);
    });
});
