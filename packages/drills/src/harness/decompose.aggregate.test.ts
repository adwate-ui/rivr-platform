import { describe, it, expect } from 'vitest';
import type { OntologyPayload, PredicateRule, QuizHand } from '../ontology/types.ts';
import { runHarness } from './quizHarness.ts';
import { aggregate, decompose } from './decompose.ts';
import { betPrinciple, fixturePayload, FLOP_HAND, foldRule, quizHand } from './fixtures.ts';

/**
 * The four aggregates drawn from the decomposition rows: accuracy on matched
 * hands, failure concentration, governing specificity, runner-up agreement.
 */

const quiz = (id: string, over: Partial<QuizHand> = {}): QuizHand =>
    quizHand(id, { ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised' }, { page_ref: '10-11', ...over });

const totals = (over: Partial<OntologyPayload> = {}) => {
    const source = fixturePayload({
        principles: [betPrinciple('wide', { street: ['flop'] })],
        quiz_hands: [quiz('q1')],
        ...over,
    });
    return aggregate(decompose(runHarness(source), source));
};

describe('the four aggregates', () => {
    it('divides correct by MATCHED, not by every scored hand', () => {
        // The whole point: the raw pass rate conflates fidelity with coverage.
        const result = totals({
            principles: [betPrinciple('flop_only', { street: ['flop'] })],
            quiz_hands: [quiz('hit'), quiz('miss', { situation_instance: { hero_cards: ['Ah', 'Kd'] } })],
        });
        expect(result).toMatchObject({ matched: 1, correct: 1, unmatched: 1 });
        // Accuracy says the one rule that spoke was right. The pass rate would
        // say 50%, blaming fidelity for a coverage hole.
        expect(result.accuracyOnMatched).toBe(1);
    });

    it('is zero rather than NaN when nothing matched at all', () => {
        expect(totals({ principles: [] })).toMatchObject({ accuracyOnMatched: 0, matched: 0 });
    });

    it('ranks failures by the principle that produced them, worst first', () => {
        const result = totals({
            principles: [betPrinciple('noisy', { street: ['flop'] })],
            quiz_hands: [
                quiz('a', { author_answer: { action: 'fold' } }),
                quiz('b', { author_answer: { action: 'fold' } }),
                quiz('c'),
            ],
        });
        expect(result.failureConcentration).toEqual([{ principleId: 'noisy', failures: 2 }]);
        expect(result.distinctFailingPrinciples).toBe(1);
    });

    it('breaks a tie in failure count by id, so the order does not wander', () => {
        const result = totals({
            principles: [
                betPrinciple('bbb', { street: ['flop'], hero_position: ['BTN'] }),
                betPrinciple('aaa', { street: ['flop'], pot_type: ['limped'] }),
            ],
            quiz_hands: [quiz('a', { author_answer: { action: 'fold' } })],
        });
        expect(result.failureConcentration.map((entry) => entry.principleId)).toEqual(['bbb']);
    });

    it('reports the specificity distribution of governing principles', () => {
        const result = totals({
            principles: [
                betPrinciple('w1', { street: ['flop'], hero_position: ['BTN'] }),
                betPrinciple('w2', { street: ['flop'], hero_position: ['BTN'], pot_type: ['single_raised'] }),
            ],
            quiz_hands: [quiz('a'), quiz('b')],
        });
        // Both hands are governed by the width-2 rule, which outranks width-1.
        expect(result.specificityDistribution).toEqual([{ specificity: 2, hands: 2 }]);
        expect(result.medianGoverningSpecificity).toBe(2);
    });

    it('takes the median across an even number of hands', () => {
        const result = totals({
            principles: [
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'], pot_type: ['single_raised'] }),
                betPrinciple('wide', { street: ['turn'] }),
            ],
            quiz_hands: [
                quiz('a'),
                quiz('b', { situation_instance: { hero_cards: ['Ah', 'Kd'], board: ['Qs', '7c', '2d', '9h'] } }),
            ],
        });
        // Widths 2 and 0.
        expect(result.medianGoverningSpecificity).toBe(1);
    });

    it('says nothing about specificity when no hand was governed', () => {
        expect(totals({ principles: [] })).toMatchObject({ specificityDistribution: [], medianGoverningSpecificity: 0 });
    });
});

describe('runner-up agreement', () => {
    it('measures how often the runner-up would have agreed', () => {
        const agreeing = totals({
            principles: [
                betPrinciple('wide', { street: ['flop'] }),
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'] }),
            ],
        });
        // Both default to bet:medium, so arbitration changed nothing here.
        expect(agreeing).toMatchObject({ handsWithRunnerUp: 1, runnerUpAgreed: 1, runnerUpAgreementRate: 1 });

        const disagreeing = totals({
            principles: [
                betPrinciple('wide', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) }),
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'] }),
            ],
        });
        // Arbitration is load-bearing here: the ranking chose the answer.
        expect(disagreeing.runnerUpAgreementRate).toBe(0);
    });

    it('compares a sizeless answer as unspecified on both sides', () => {
        // `fold` carries no sizing. Comparing "fold:" against "fold:unspecified"
        // would report a disagreement between a rule and itself.
        const sizeless: PredicateRule = foldRule({ street: ['flop'] });
        const result = totals({
            principles: [
                betPrinciple('wide', { street: ['flop'] }, { rule: sizeless }),
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'] }, {
                    rule: { ...sizeless, situation: { street: ['flop'], hero_position: ['BTN'] } },
                }),
            ],
            quiz_hands: [quiz('q1', { author_answer: { action: 'fold' } })],
        });
        expect(result.runnerUpAgreementRate).toBe(1);
    });

    it('reads no runner-up anywhere as full agreement rather than none', () => {
        // Dividing by zero would report 0% and read as maximum disagreement,
        // which is the opposite of what "nothing was contested" means.
        expect(totals()).toMatchObject({ handsWithRunnerUp: 0, runnerUpAgreementRate: 1 });
    });
});
