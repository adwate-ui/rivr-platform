import { describe, it, expect, beforeEach } from 'vitest';
import type { QuizHand } from '../ontology/types.ts';
import { CODES } from './index.ts';
import { stage3Vocabulary } from './stage3.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';
import { codes, payload } from './fixtures.ts';

beforeEach(() => resetTagCompatibilityCache());

describe('stage 3: vocabulary', () => {
    it('passes hands that parse', () => {
        expect(stage3Vocabulary(payload())).toEqual([]);
    });

    it('catches notation the schema regex lets through but no parser accepts', () => {
        // "AAs" matches the schema pattern — two ranks and an s — and is not a
        // hand. This is exactly the gap stage 3 exists to close.
        const broken = payload({ range_sets: [{ id: 'rs_1', hands: ['AAs'] }] });
        expect(codes(stage3Vocabulary(broken))).toContain(CODES.BAD_RANGE_NOTATION);
    });

    it('checks excludes as well as hands', () => {
        const broken = payload({ range_sets: [{ id: 'rs_1', hands: ['AA'], excludes: ['ATs-KQs'] }] });
        expect(codes(stage3Vocabulary(broken))).toContain(CODES.BAD_RANGE_NOTATION);
    });

    it('catches a card that is not a card', () => {
        const broken = payload({
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Zx'] },
                author_answer: { action: 'fold' },
            }],
        });
        expect(codes(stage3Vocabulary(broken))).toContain(CODES.BAD_CARD);
    });

    it('catches the same card dealt twice', () => {
        const broken = payload({
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Ah', '7c', '2d'] },
                author_answer: { action: 'fold' },
            }],
        });
        expect(codes(stage3Vocabulary(broken))).toContain(CODES.DUPLICATE_CARD);
    });

    it('checks a quiz hand that gives only hole cards, or only a board', () => {
        const holeOnly = payload({
            quiz_hands: [{
                id: 'q1', source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Ah'] },
                author_answer: { action: 'fold' },
            }],
        });
        expect(codes(stage3Vocabulary(holeOnly))).toContain(CODES.DUPLICATE_CARD);

        const boardOnly = payload({
            quiz_hands: [{
                id: 'q2', source_id: 'src_test',
                situation_instance: { board: ['Ah', '7c', '2d'] },
                author_answer: { action: 'fold' },
            }],
        });
        expect(stage3Vocabulary(boardOnly)).toEqual([]);
    });

    it('accepts a well-formed quiz hand', () => {
        const good = payload({
            quiz_hands: [{
                id: 'q1',
                source_id: 'src_test',
                situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d'] },
                author_answer: { action: 'bet', sizing: 'medium' },
            }],
        });
        expect(stage3Vocabulary(good)).toEqual([]);
    });
});

describe('stage 3: every hand either answers or says why not', () => {
    /**
     * The two halves of one invariant.
     *
     * A quiz hand is evidence about the encoding only if the answer it is
     * scored against is the AUTHOR'S. Two ways that stops being true, and the
     * validator has to refuse both: an answer with no author behind it, and an
     * `indeterminate` flag with no reason behind it.
     *
     * The second is the one that matters in practice. `indeterminate` drops a
     * hand out of scoring entirely, so it is the bucket every inconvenient hand
     * drifts into, and the pass rate rises without a single rule improving.
     * Requiring a written reason is what keeps that an owner's decision made
     * against the source rather than a way of tidying a failure report.
     */
    const unanswered = (over: Partial<QuizHand> = {}): QuizHand => ({
        id: 'q1',
        source_id: 'src_test',
        situation_instance: { hero_cards: ['Ah', 'Kd'] },
        ...over,
    });
    const hand = (over: Partial<QuizHand> = {}): QuizHand =>
        unanswered({ author_answer: { action: 'raise', sizing: 'medium' }, ...over });

    const run = (quiz: QuizHand) => codes(stage3Vocabulary(payload({ quiz_hands: [quiz] })));

    it('refuses a scored hand with no answer', () => {
        expect(run(unanswered())).toContain(CODES.MISSING_AUTHOR_ANSWER);
    });

    it('refuses an indeterminate hand with no reason', () => {
        expect(run(unanswered({ indeterminate: true }))).toContain(CODES.UNJUSTIFIED_INDETERMINATE);
    });

    it('refuses a reason that is only whitespace', () => {
        expect(run(hand({ indeterminate: true, indeterminate_reason: '   ' })))
            .toContain(CODES.UNJUSTIFIED_INDETERMINATE);
    });

    it('accepts an indeterminate hand that gives a reason from the source', () => {
        const found = run(unanswered({
            indeterminate: true,
            indeterminate_reason: 'The source sets out both lines and declines to choose between them, '
                + 'so there is nothing to score against.',
        }));
        expect(found).not.toContain(CODES.UNJUSTIFIED_INDETERMINATE);
        // And it is not then also asked for the answer it just explained away.
        expect(found).not.toContain(CODES.MISSING_AUTHOR_ANSWER);
    });

    it('accepts a scored hand that has an answer', () => {
        expect(run(hand())).not.toContain(CODES.MISSING_AUTHOR_ANSWER);
    });

    it('passes a source with no quiz hands at all', () => {
        expect(codes(stage3Vocabulary(payload()))).not.toContain(CODES.MISSING_AUTHOR_ANSWER);
    });
});
