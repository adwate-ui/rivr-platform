import { describe, it, expect } from 'vitest';
import type { Principle } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { AnswerKindMismatchError, gradeAnswer, gradeLabel } from './grade.ts';
import type { ClassifyResolution, Resolution } from './resolve.ts';

/**
 * Grading, dispatched on the kind of question.
 *
 * The case worth the most attention is the mismatch: an action answer arriving
 * against a classify resolution means the pad and the governing rule have come
 * apart, and every answer after that point is meaningless. It throws rather
 * than grading, because grading it "wrong" would file a wiring fault under the
 * reader's score and nobody would look for it there.
 */


const scenario: Scenario = {
    street: 'flop',
    heroPosition: 'BTN',
    potType: 'single_raised',
    playerCount: 'heads_up',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    stackBracket: 'standard',
    postflopFacingState: 'facing_check',
    villainRaiseSize: 'large',
    villainType: 'opp_nit',
    board: [card('Qs'), card('7c'), card('2d')],
    hole: [card('Ah'), card('Kd')],
    holder: 'hero',
    boardTags: ['rainbow'],
    nodePath: [],
    seed: 0,
};

const principle: Principle = {
    id: 'pr',
    source_id: 'src',
    name: 'Synthetic',
    rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'bet' } },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x' },
};

const actionResolution: Resolution = {
    kind: 'action',
    outcome: { action: 'bet', sizing: 'medium' },
    provenance: { kind: 'default', detail: 'no branch matched' },
    shadowed: [],
};

const labelResolution: ClassifyResolution = {
    kind: 'classify',
    outcome: { label: 'strong_fit' },
    provenance: { kind: 'default', detail: 'no branch matched' },
    shadowed: [],
};

describe('grading a label', () => {
    it('is correct when it is the label the source gives', () => {
        expect(gradeLabel('strong_fit', labelResolution))
            .toEqual({ klass: 'correct', correct: true, secondary: false });
    });

    it('has exactly one way to be wrong, and it carries no direction', () => {
        // Labels are an unordered partition: "weak fit" is not a more passive
        // answer than "strong fit", it is a different reading. So there is no
        // too_loose/too_tight counterpart to report here.
        expect(gradeLabel('weak_fit', labelResolution))
            .toEqual({ klass: 'wrong_label', correct: false, secondary: false });
    });

    it('never reports a secondary answer, because a reading has no runner-up', () => {
        expect(gradeLabel('strong_fit', labelResolution).secondary).toBe(false);
        expect(gradeLabel('anything_else', labelResolution).secondary).toBe(false);
    });
});

describe('dispatching on the kind of question', () => {
    it('sends an action answer to the action grader', () => {
        const grade = gradeAnswer(
            { kind: 'action', answer: { action: 'bet', sizing: 'medium' } },
            actionResolution, scenario, principle,
        );
        expect(grade).toMatchObject({ klass: 'correct', correct: true });
    });

    it('still reports the action grader\'s own verdicts, not a flattened one', () => {
        const grade = gradeAnswer(
            { kind: 'action', answer: { action: 'bet', sizing: 'small' } },
            actionResolution, scenario, principle,
        );
        expect(grade.klass).toBe('wrong_sizing');
        expect(grade.correct).toBe(false);
    });

    it('sends a label answer to the label grader', () => {
        expect(gradeAnswer(
            { kind: 'classify', label: 'strong_fit' }, labelResolution, scenario, principle,
        )).toMatchObject({ klass: 'correct', correct: true });
        expect(gradeAnswer(
            { kind: 'classify', label: 'weak_fit' }, labelResolution, scenario, principle,
        )).toMatchObject({ klass: 'wrong_label', correct: false });
    });

    it('throws when the answer and the question are different kinds', () => {
        expect(() => gradeAnswer(
            { kind: 'action', answer: { action: 'bet' } }, labelResolution, scenario, principle,
        )).toThrow(AnswerKindMismatchError);

        expect(() => gradeAnswer(
            { kind: 'classify', label: 'strong_fit' }, actionResolution, scenario, principle,
        )).toThrow(AnswerKindMismatchError);
    });

    it('says which way round the mismatch was', () => {
        // The message has to name both halves: "a classify question cannot be
        // answered with an action" and its reverse are different faults in
        // different places.
        try {
            gradeAnswer({ kind: 'action', answer: { action: 'bet' } }, labelResolution, scenario, principle);
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(AnswerKindMismatchError);
            if (!(error instanceof AnswerKindMismatchError)) return;
            expect(error.asked).toBe('classify');
            expect(error.answered).toBe('action');
            expect(error.message).toContain('classify');
            expect(error.message).toContain('action');
        }
    });
});
