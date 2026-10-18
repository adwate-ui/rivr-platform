import { describe, it, expect } from 'vitest';
import type { OntologyPayload, PredicateRule, QuizHand, Situation } from '../ontology/types.ts';
import { runHarness } from './quizHarness.ts';
import { scopeGaps } from './scopeGap.ts';
import {
    betPrinciple, fixturePayload, FLOP_HAND, foldRule, quizHand, TURN_HAND, withoutQuizHands,
} from './fixtures.ts';

/**
 * The re-encoding work list.
 *
 * What it has to get right is the distinction the whole exercise turns on: a
 * condition in `situation` narrows what a rule CLAIMS; the same condition in a
 * branch only narrows what it ANSWERS. Reporting the second as though it were
 * the first would send the reader to the wrong passage.
 *
 * Fixtures are synthetic. "Always bet" is not advice.
 */

/** Flop, first to act, on the button in a single-raised pot, citing a page span. */
const quiz = (id: string, over: Partial<QuizHand> = {}): QuizHand => quizHand(id, {
    ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised', postflop_facing_state: 'first_to_act',
}, { page_ref: '10-11', ...over });

const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload => fixturePayload({
    principles: [betPrinciple('wide', { street: ['flop'] })],
    quiz_hands: [quiz('q1')],
    ...over,
});

/** A flop rule that checks unless a branch says otherwise. */
const checking = (branches: PredicateRule['branches'], over: Partial<PredicateRule> = {}): PredicateRule => ({
    kind: 'predicate', situation: { street: ['flop'] }, branches, default: { action: 'check' }, ...over,
});

const run = (over: Partial<OntologyPayload> = {}) => {
    const source = payload(over);
    return scopeGaps(runHarness(source), source);
};

const flop: Situation = { street: ['flop'] };

describe('the demoted scope', () => {
    it('reports a coordinate the branches read and the situation does not', () => {
        // The encoder knew hand class mattered (they wrote it into a branch),
        // but a branch cannot stop the rule claiming spots where it does not
        // hold. That is the whole failure mode.
        const gaps = run({
            principles: [betPrinciple('leaky', flop, {
                rule: checking([{ when: { hand_class_any: ['set'] }, then: { action: 'bet' } }]),
            })],
        });
        expect(gaps[0]?.demotedToBranches).toEqual(['hand_class_any']);
    });

    it('does not report a coordinate the situation already enforces', () => {
        // Constrained in both places is not a leak: the rule already refuses
        // spots where it does not hold.
        const position: Situation = { street: ['flop'], hero_position: ['BTN'] };
        const gaps = run({
            principles: [betPrinciple('tight', position, {
                rule: checking([{ when: { hero_position: ['BTN'] }, then: { action: 'bet', sizing: 'medium' } }], {
                    situation: position,
                }),
            })],
        });
        expect(gaps[0]?.demotedToBranches).toEqual([]);
    });

    it('ignores a branch condition that constrains nothing', () => {
        const gaps = run({
            principles: [betPrinciple('empty', flop, {
                rule: checking([{ when: { hand_class_any: [] }, then: { action: 'bet' } }]),
            })],
        });
        expect(gaps[0]?.demotedToBranches).toEqual([]);
    });

    it('has no branches to report for a range lookup', () => {
        const gaps = run({
            principles: [betPrinciple('lookup', flop, {
                rule: {
                    kind: 'range_lookup',
                    situation: flop,
                    range_set_id: 'rs',
                    in_range: { action: 'bet', sizing: 'medium' },
                    out_of_range: { action: 'check' },
                },
            })],
        });
        expect(gaps[0]).toMatchObject({ demotedToBranches: [], hasDefault: false, defaultAnswer: null });
    });
});

describe('the fallthrough count', () => {
    it('counts the governed hands that reached the default', () => {
        // Each one is a spot no branch covered, answered anyway: the candidates
        // for dropping the default and letting the rule abstain.
        const gaps = run({
            principles: [betPrinciple('catchall', flop, {
                rule: checking([{ when: { hand_class_any: ['set'] }, then: { action: 'bet' } }]),
            })],
            quiz_hands: [quiz('a'), quiz('b')],
        });
        expect(gaps[0]).toMatchObject({ answeredByDefault: 2, defaultAnswer: 'check:unspecified' });
    });

    it('is zero for a rule whose branches actually cover its hands', () => {
        const gaps = run({
            principles: [betPrinciple('covered', flop, {
                rule: checking([{ when: { hero_position: ['BTN'] }, then: { action: 'bet', sizing: 'medium' } }]),
            })],
        });
        expect(gaps[0]?.answeredByDefault).toBe(0);
    });

    it('says a rule already abstains where it has no default', () => {
        const { default: _none, ...abstaining } = checking([
            { when: { hero_position: ['BTN'] }, then: { action: 'bet', sizing: 'medium' } },
        ]);
        const gaps = run({ principles: [betPrinciple('abstains', flop, { rule: abstaining })] });
        expect(gaps[0]).toMatchObject({ hasDefault: false, answeredByDefault: 0 });
    });
});

describe('the work list itself', () => {
    it('carries the page reference for every hand, so the passage can be found', () => {
        const gaps = run({ quiz_hands: [quiz('a', { page_ref: 42 })] });
        expect(gaps[0]?.hands[0]).toMatchObject({ pageRef: '42', quizId: 'a' });
    });

    it('leaves the page null where the hand does not cite one', () => {
        const { page_ref: _none, ...unpaged } = quiz('a');
        expect(run({ quiz_hands: [unpaged] })[0]?.hands[0]?.pageRef).toBeNull();
    });

    it('records both answers and how the encoding arrived at its own', () => {
        const gaps = run({ quiz_hands: [quiz('a', { author_answer: { action: 'fold' } })] });
        expect(gaps[0]?.hands[0]).toMatchObject({
            verdict: 'fail',
            expected: 'fold:unspecified',
            actual: 'bet:medium',
            answeredBy: 'default',
        });
    });

    it('carries the line the rule requires, now that matching honours it', () => {
        const gaps = run({
            principles: [betPrinciple('pathed', { street: ['flop'], node_path: ['flop_bet'] })],
            quiz_hands: [quiz('a', { situation_instance: { ...FLOP_HAND, action_log: ['flop_bet'] } })],
        });
        expect(gaps[0]?.pathScope).toEqual(['flop_bet']);
    });

    it('puts the worst offender first', () => {
        const gaps = run({
            principles: [
                betPrinciple('one_wrong', { street: ['turn'] }, { rule: foldRule({ street: ['turn'] }) }),
                betPrinciple('two_wrong', flop, { rule: foldRule(flop) }),
            ],
            quiz_hands: [
                quiz('a'),
                quiz('b'),
                quiz('c', { situation_instance: { ...TURN_HAND, hero_position: 'BTN', postflop_facing_state: 'first_to_act' } }),
            ],
        });
        expect(gaps.map((gap) => gap.principleId)).toEqual(['two_wrong', 'one_wrong']);
        expect(gaps[0]).toMatchObject({ wrong: 2, right: 0 });
    });

    it('breaks a tie by claim count, then by id', () => {
        const gaps = run({ principles: [betPrinciple('zulu', flop), betPrinciple('alpha', flop)] });
        expect(gaps.map((gap) => gap.principleId)).toEqual(['alpha', 'zulu']);
    });

    it('carries the separating coordinate as the evidence', () => {
        const gaps = run({
            principles: [betPrinciple('blind', flop)],
            quiz_hands: [
                quiz('right'),
                quiz('wrong', {
                    situation_instance: { ...FLOP_HAND, hero_position: 'SB', postflop_facing_state: 'first_to_act' },
                    author_answer: { action: 'check' },
                }),
            ],
        });
        expect(gaps[0]?.separators).toContainEqual({ slot: 'hero_position', onPasses: ['BTN'], onFailures: ['SB'] });
    });

    it('leaves out a principle nothing claims and nothing leaks from', () => {
        const gaps = run({ principles: [betPrinciple('wide', flop), betPrinciple('irrelevant', { street: ['river'] })] });
        expect(gaps.map((gap) => gap.principleId)).toEqual(['wide']);
    });

    it('leaves out concept principles, which have no decision to re-encode', () => {
        expect(run({ principles: [betPrinciple('concept', flop, { drillable: false })] })).toEqual([]);
    });

    it('skips a hand it cannot read, and a source with no quiz hands', () => {
        expect(run({ quiz_hands: [quiz('bad', { situation_instance: { hero_cards: ['Ah'] } })] })).toEqual([]);
        const source = withoutQuizHands(payload());
        expect(scopeGaps(runHarness(source), source)).toEqual([]);
    });
});
