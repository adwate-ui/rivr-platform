import { describe, it, expect } from 'vitest';
import type { OntologyPayload, QuizHand } from '../ontology/types.ts';
import { runHarness } from './quizHarness.ts';
import { decompose } from './decompose.ts';
import {
    betPrinciple, fixturePayload, FLOP_HAND, foldRule, quizHand, withoutQuizHands,
} from './fixtures.ts';

/**
 * Failure decomposition, one row per hand.
 *
 * The organising idea: a pass rate is one number standing in for two unrelated
 * things, fidelity and coverage, so it cannot tell you what to do next. These
 * tests pin the separation, and in particular that PASSES are emitted. A pass
 * from a low-specificity rule that claimed a spot a narrower rule should have
 * claimed is right by coincidence of ranking, and only the per-hand row shows
 * it.
 */

const quiz = (id: string, over: Partial<QuizHand> = {}): QuizHand =>
    quizHand(id, { ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised' }, { page_ref: '10-11', ...over });

const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload => fixturePayload({
    principles: [betPrinciple('wide', { street: ['flop'] })],
    quiz_hands: [quiz('q1')],
    ...over,
});

const run = (over: Partial<OntologyPayload> = {}) => {
    const source = payload(over);
    return decompose(runHarness(source), source);
};

describe('one row per scored hand', () => {
    it('emits passes as well as failures', () => {
        // A pass produced by a rule that should not have governed is a latent
        // failure. Dropping passes from the output hides exactly that.
        const rows = run({
            quiz_hands: [quiz('pass_one'), quiz('fail_one', { author_answer: { action: 'fold' } })],
        });
        expect(rows.map((row) => [row.quiz_hand_id, row.outcome]))
            .toEqual([['pass_one', 'pass'], ['fail_one', 'fail']]);
    });

    it('leaves out indeterminate hands, which have nothing to be right about', () => {
        const rows = run({
            quiz_hands: [quiz('q1'), quiz('q2', { indeterminate: true })],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]?.quiz_hand_id).toBe('q1');
    });

    it('carries the page reference so an answer traces back to the passage', () => {
        const { page_ref: _none, ...unpaged } = quiz('q1');
        expect(run()[0]?.page_ref).toBe('10-11');
        expect(run({ quiz_hands: [unpaged] })[0]?.page_ref).toBeNull();
    });

    it('records the governing principle, its width, and how many competed', () => {
        const rows = run({
            principles: [
                betPrinciple('wide', { street: ['flop'] }),
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'], pot_type: ['single_raised'] }),
            ],
        });
        expect(rows[0]).toMatchObject({
            governing_principle_id: 'narrow', governing_specificity: 2, candidate_count: 2, runner_up_id: 'wide',
        });
    });

    it('records what the runner-up would have answered', () => {
        // The figure that says whether arbitration is doing useful work.
        const rows = run({
            principles: [
                betPrinciple('wide', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) }),
                betPrinciple('narrow', { street: ['flop'], hero_position: ['BTN'] }),
            ],
        });
        expect(rows[0]?.runner_up_would_have_answered).toBe('fold:unspecified');
        expect(rows[0]?.actual_action).toBe('bet');
    });

    it('leaves the runner-up null when only one principle matched', () => {
        expect(run()[0]).toMatchObject({ candidate_count: 1, runner_up_id: null, runner_up_would_have_answered: null });
    });

    it('reports both answers side by side', () => {
        const rows = run({ quiz_hands: [quiz('q1', { author_answer: { action: 'fold' } })] });
        expect(rows[0]).toMatchObject({
            expected_action: 'fold', expected_sizing: null, actual_action: 'bet', actual_sizing: 'medium',
        });
    });

    it('names the blocking coordinate on an unmatched hand', () => {
        // A principle on the same street, excluded by one coordinate: the
        // nearest miss, and the row that turns "nothing covered this" into a
        // thing somebody can go and fix.
        const rows = run({
            principles: [betPrinciple('nearly', { street: ['flop'], pot_type: ['three_bet'] })],
        });
        expect(rows[0]).toMatchObject({
            outcome: 'unmatched',
            governing_principle_id: null,
            governing_specificity: null,
            candidate_count: 0,
            nearest_principle_id: 'nearly',
            blocking_coordinate: 'pot_type=single_raised',
        });
    });

    it('joins several blocking coordinates into one field', () => {
        const rows = run({
            principles: [betPrinciple('nearly', {
                street: ['flop'], pot_type: ['three_bet'], hero_position: ['SB'],
            })],
        });
        expect(rows[0]?.blocking_coordinate).toBe('hero_position=BTN, pot_type=single_raised');
    });

    it('leaves every principle-shaped field null when a hand matched nothing at all', () => {
        const rows = run({ principles: [betPrinciple('elsewhere', { street: ['river'] })] });
        expect(rows[0]?.nearest_principle_id).toBeNull();
        expect(rows[0]?.blocking_coordinate).toBeNull();
    });

    it('handles a source with no quiz hands rather than assuming the array', () => {
        const source = withoutQuizHands(payload());
        expect(decompose(runHarness(source), source)).toEqual([]);
    });

    it('folds an unreadable hand into unmatched, with no neighbour to point at', () => {
        // Both mean "no governing principle answered". They stay tellable apart
        // by the missing nearest_principle_id: there was no readable spot to
        // find a neighbour for.
        const rows = run({ quiz_hands: [quiz('bad', { situation_instance: { hero_cards: ['Ah'] } })] });
        expect(rows[0]).toMatchObject({ outcome: 'unmatched', nearest_principle_id: null, blocking_coordinate: null });
    });
});
