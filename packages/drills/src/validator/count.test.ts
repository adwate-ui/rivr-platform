import { describe, it, expect, beforeEach } from 'vitest';
import type { AuthorAnswer, CountRule, Principle, QuizHand, Situation } from '../ontology/types.ts';
import { parsePayload } from '../parse/payload.ts';
import { validateSource, CODES } from './index.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

/** A count principle; the rule's situation and filter are the caller's to change. */
const counting = (rule: Partial<CountRule> = {}, over: Partial<Principle> = {}): Principle => ({
    id: 'pr_count',
    source_id: 'src_test',
    name: 'Top pair or better',
    rule: {
        kind: 'count',
        situation: { street: ['flop'] },
        range_set_id: 'rs_1',
        dead_cards: 'board',
        filter: { kind: 'hand_class_min', hand_class: 'top_pair_weak_kicker' },
        prompt: 'How many combinations make top pair or better?',
        ...rule,
    },
    rationale: 'Because.',
    feedback: { correct: 'Right.', too_few: 'More than that.', too_many: 'Fewer than that.' },
    ...over,
});

const findingsFor = (principles: Principle[]) => validateSource(payload({ ontology_version: '2.0', principles })).findings;

describe('a rule that answers with a number (ontology 2.0)', () => {
    /*
     * A count is the only answer kind the engine works out for itself, so what
     * the validator has to catch is not a wrong answer but a question that does
     * not make sense: a range question scoped to one holding, or an authored
     * field nothing reads.
     */
    it('validates without being asked for action feedback it has no actions for', () => {
        expect(findingsFor([counting()]).filter((finding) => finding.severity === 'error')).toEqual([]);
    });

    const scopedTo: [string, Situation][] = [
        ['hand_class_any', { street: ['flop'], hand_class_any: ['set'] }],
        ['draw_class_any', { street: ['flop'], draw_class_any: ['flush_draw'] }],
        ['draw_class_exclude', { street: ['flop'], draw_class_exclude: ['flush_draw'] }],
        ['relative_strength_any', { street: ['flop'], relative_strength_any: ['nuts'] }],
    ];
    it.each(scopedTo)('refuses a count scoped to %s', (_slot, situation) => {
        // The question is about the opponent's whole range against this board.
        // Scoped to one holding it would generate spots where the answer does
        // not depend on the thing being varied: a drill that looks like it is
        // testing something and is not.
        expect(codes(findingsFor([counting({ situation })]))).toContain(CODES.ANSWER_KIND_MISMATCH);
    });

    it.each(['exceptions', 'modifiers'] as const)(
        'refuses %s on a count rule rather than ignoring them',
        (field) => {
            const withField = field === 'exceptions'
                ? counting({}, { exceptions: [{ when: { street: ['flop'] }, then: { action: 'bet' } }] })
                : counting({}, { modifiers: [{ id: 'm1', when: {}, effect: { substitute_outcome: { action: 'bet' } } }] });
            expect(codes(findingsFor([withField]))).toContain(CODES.ANSWER_KIND_MISMATCH);
        },
    );

    it('never calls a count rule one that answers nothing', () => {
        // It has no branches and no default by design: a range against a board
        // has exactly one answer, and the engine can always finish the sum.
        expect(codes(findingsFor([counting()]))).not.toContain(CODES.RULE_NEVER_ANSWERS);
    });
});

describe('a quiz hand the author answered with a number', () => {
    const quiz = (author_answer: AuthorAnswer): QuizHand => ({
        id: 'q1',
        source_id: 'src_test',
        situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qh', '8c', '3d'] },
        author_answer,
    });

    it('takes a number, with or without the source\'s hedge, and a hand with no hero cards', () => {
        const findings = parsePayload(payload({
            ontology_version: '2.0',
            quiz_hands: [
                quiz({ kind: 'count', value: 17 }),
                // No `hero_cards` key at all, as a JSON file without one has none.
                {
                    id: 'q2',
                    source_id: 'src_test',
                    situation_instance: { board: ['Qh', '8c', '3d'] },
                    author_answer: { kind: 'count', value: 44, tolerance: 4 },
                },
            ],
        })).findings;
        expect(findings).toEqual([]);
    });

    it.each([
        ['a negative count', { kind: 'count', value: -1 }],
        ['a fractional count', { kind: 'count', value: 20.5 }],
        ['a label with no label', { kind: 'classify' }],
        ['a kind that is neither', { kind: 'guess', value: 3 }],
        ['a count carrying a stray field', { kind: 'count', value: 17, label: 'x' }],
    ])('refuses %s', (_name, answer) => {
        const raw = {
            ...payload({ ontology_version: '2.0' }),
            quiz_hands: [{ ...quiz({ kind: 'count', value: 0 }), author_answer: answer }],
        };
        expect(parsePayload(raw).findings).not.toEqual([]);
    });
});

describe('the bare ace of a suit nobody named', () => {
    const bareAce = (situation: Situation, suit?: 'h'): Principle => counting({
        situation,
        filter: suit === undefined ? { kind: 'bare_ace_of_suit' } : { kind: 'bare_ace_of_suit', suit },
        prompt: 'How many hold the bare ace of the suit?',
    }, { id: 'pr_bare_ace', name: 'Bare ace', feedback: { correct: 'Right.', too_few: 'More.', too_many: 'Fewer.' } });
    const codesFor = (principle: Principle) => codes(findingsFor([principle]));

    it('takes the suit from a flop the rule requires to be monotone', () => {
        expect(codesFor(bareAce({ street: ['flop'], board_require: ['monotone'] })))
            .not.toContain(CODES.COUNT_SUIT_UNSTATED);
    });

    it('refuses a suitless question on a flop that may have no flush suit', () => {
        expect(codesFor(bareAce({ street: ['flop'] }))).toContain(CODES.COUNT_SUIT_UNSTATED);
        expect(codesFor(bareAce({ street: ['flop'], board_require: ['two_tone'] }))).toContain(CODES.COUNT_SUIT_UNSTATED);
    });

    it('lets a named suit stand anywhere', () => {
        expect(codesFor(bareAce({ street: ['flop'] }, 'h'))).not.toContain(CODES.COUNT_SUIT_UNSTATED);
    });
});
