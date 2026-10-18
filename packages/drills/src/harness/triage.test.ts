import { describe, it, expect } from 'vitest';
import type { OntologyPayload, PredicateRule, QuizHand, Situation } from '../ontology/types.ts';
import { runHarness } from './quizHarness.ts';
import { bucketCounts, separation, triage, type FailureBucket, type TriagedFailure } from './diagnostics.ts';
import {
    betPrinciple, fixturePayload, FLOP_HAND, foldRule, quizHand, readSpot, TURN_HAND, withoutQuizHands,
} from './fixtures.ts';

/**
 * Triage: whether the failures are a work list or a scope problem, and what
 * separates a rule's right answers from its wrong ones.
 */

/** Flop, first to act, on the button in a single-raised pot. */
const SPOT = { ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised', postflop_facing_state: 'first_to_act' } as const;

const quiz = (id: string, over: Partial<QuizHand> = {}): QuizHand => quizHand(id, SPOT, over);

const payload = (over: Partial<OntologyPayload> = {}): OntologyPayload => fixturePayload({
    principles: [betPrinciple('wide', { street: ['flop'] })],
    quiz_hands: [quiz('q1')],
    ...over,
});

const triaged = (over: Partial<OntologyPayload>) => {
    const source = payload(over);
    return triage(runHarness(source), source);
};

const failure = (bucket: FailureBucket): TriagedFailure => ({
    quizId: 'q', bucket, governingPrincipleId: 'p', governingWidth: 0, unconstrainedButStated: [],
});

const listed = <T>(value: T | undefined): T[] => (value === undefined ? [] : [value]);

describe('triage', () => {
    it('says when the rule that had it right lost the ranking', () => {
        // Two rules of equal width, the wrong one declared first, so the WIDE
        // rule governs and the right one is the rescuer.
        const position: Situation = { street: ['flop'], hero_position: ['BTN'] };
        const failures = triaged({
            principles: [
                betPrinciple('wrong_first', position, { rule: foldRule(position) }),
                betPrinciple('right_second', position),
            ],
        });
        expect(failures).toHaveLength(1);
        expect(failures[0]).toMatchObject({
            bucket: 'lost_to_a_more_specific_rule', governingPrincipleId: 'wrong_first', correctCandidateId: 'right_second',
        });
    });

    it('says a rule is possibly too broad, and which coordinates it ignores', () => {
        const failures = triaged({
            principles: [betPrinciple('broad', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) })],
        });
        expect(failures[0]).toMatchObject({ bucket: 'possibly_too_broad', governingWidth: 0 });
        expect(failures[0]?.unconstrainedButStated).toContain('hero_position');
        expect(failures[0]?.unconstrainedButStated).toContain('pot_type');
        expect(failures[0]?.correctCandidateId).toBeUndefined();
    });

    it('says the outcome is simply wrong when the rule reads everything stated', () => {
        // Built FROM the scenario so the fixture cannot drift out of step with
        // what the classifiers actually produce for this board.
        const spot = readSpot(quiz('a'), payload());
        const everything: Situation = {
            street: [spot.street],
            hero_position: [spot.heroPosition],
            pot_type: listed(spot.potType),
            postflop_facing_state: listed(spot.postflopFacingState),
            hand_class_any: listed(spot.handClass),
            draw_class_any: [...(spot.draws ?? [])],
            relative_strength_any: listed(spot.relativeStrength),
        };
        const failures = triaged({
            principles: [betPrinciple('precise', everything, { rule: foldRule(everything) })],
            quiz_hands: [quiz('a', { author_answer: { action: 'check' } })],
        });
        expect(failures[0]?.bucket).toBe('wrong_outcome');
        expect(failures[0]?.unconstrainedButStated).toEqual([]);
    });

    it('never offers `indeterminate` as a bucket', () => {
        // Dropping a hand out of scoring needs a reason written from the source.
        // A tool cannot read the passage, so it must not offer the verdict.
        const buckets = bucketCounts(triaged({
            principles: [betPrinciple('broad', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) })],
        })).map((entry) => entry.bucket);
        expect(buckets).not.toContain('indeterminate');
    });

    it('counts the buckets, biggest first, and breaks a tie by name', () => {
        expect(bucketCounts([])).toEqual([]);
        expect(bucketCounts([failure('possibly_too_broad'), failure('wrong_outcome'), failure('possibly_too_broad')]))
            .toEqual([{ bucket: 'possibly_too_broad', failures: 2 }, { bucket: 'wrong_outcome', failures: 1 }]);
        expect(bucketCounts([failure('wrong_outcome'), failure('possibly_too_broad')]))
            .toEqual([{ bucket: 'possibly_too_broad', failures: 1 }, { bucket: 'wrong_outcome', failures: 1 }]);
    });

    it('has nothing to say about a hand that passed, or one nothing matched', () => {
        expect(triaged({})).toEqual([]);
        expect(triaged({ principles: [betPrinciple('elsewhere', { street: ['river'] })] })).toEqual([]);
        const source = withoutQuizHands(payload());
        expect(triage(runHarness(source), source)).toEqual([]);
    });

    it('records what the landed card changed alongside the ignored coordinates', () => {
        // The failure record carries the runout for turn and river hands: it is
        // the coordinate most likely to separate a rule's right turns from its
        // wrong ones.
        const turn = quiz('t', {
            situation_instance: { ...TURN_HAND, board: ['Qs', '7c', '2d', '3h'], hero_position: 'BTN', postflop_facing_state: 'first_to_act' },
            author_answer: { action: 'fold' },
        });
        const failures = triaged({ principles: [betPrinciple('turnwide', { street: ['turn'] })], quiz_hands: [turn] });
        expect(failures[0]?.bucket).toBe('possibly_too_broad');
        expect(failures[0]?.unconstrainedButStated).toContain('runout_any');
    });
});

describe('separating a sizing miss from a wrong decision', () => {
    // Not the same defect: "bet small" against "bet big" disagrees about one
    // word; "fold" against "bet" disagrees about the decision. Counting them
    // together overstates the second and hides the first, the cheaper fix.
    const sized = (id: string, sizing: 'small' | 'large') => quiz(id, { author_answer: { action: 'bet', sizing } });
    const sizedRule = (situation: Situation, sizing: 'small' | 'large'): PredicateRule => ({
        kind: 'predicate', situation, branches: [], default: { action: 'bet', sizing },
    });

    it('calls it sizing_only when the action was right', () => {
        expect(triaged({ quiz_hands: [sized('q', 'large')] })[0]?.bucket).toBe('sizing_only');
    });

    it('does not call it sizing_only when the action was wrong', () => {
        expect(triaged({ quiz_hands: [quiz('q', { author_answer: { action: 'fold' } })] })[0]?.bucket)
            .not.toBe('sizing_only');
    });

    it('still prefers the rule that had it exactly right, when one exists', () => {
        // A more specific rule getting the whole answer right is a complete fix.
        const position: Situation = { street: ['flop'], hero_position: ['BTN'] };
        const failures = triaged({
            principles: [
                betPrinciple('broad', { street: ['flop'] }, { rule: sizedRule({ street: ['flop'] }, 'small') }),
                betPrinciple('narrow', position, { rule: sizedRule(position, 'large') }),
            ],
            quiz_hands: [sized('q', 'small')],
        });
        expect(failures[0]).toMatchObject({ bucket: 'lost_to_a_more_specific_rule', correctCandidateId: 'broad' });
    });

    it('counts it as its own bucket in the summary', () => {
        expect(bucketCounts(triaged({ quiz_hands: [sized('q', 'large')] })))
            .toContainEqual({ bucket: 'sizing_only', failures: 1 });
    });
});

describe('what separates a rule\'s right answers from its wrong ones', () => {
    const splitsOf = (over: Partial<OntologyPayload>) => {
        const source = payload(over);
        return separation(runHarness(source), source);
    };
    const onTheTurn = (id: string) => quiz(id, {
        situation_instance: { ...TURN_HAND, hero_position: 'BTN', postflop_facing_state: 'first_to_act' },
    });

    it('finds the coordinate whose values split the passes from the failures', () => {
        // Always bet medium: right on the button, wrong in the small blind, and
        // position is the only thing that differs.
        const splits = splitsOf({
            principles: [betPrinciple('blind', { street: ['flop'] })],
            quiz_hands: [
                quiz('right'),
                quiz('wrong', { situation_instance: { ...SPOT, hero_position: 'SB' }, author_answer: { action: 'check' } }),
            ],
        });
        expect(splits).toHaveLength(1);
        expect(splits[0]).toMatchObject({ principleId: 'blind', governed: 2, passed: 1, failed: 1 });
        expect(splits[0]?.separators).toContainEqual({ slot: 'hero_position', onPasses: ['BTN'], onFailures: ['SB'] });
    });

    it('offers no separator for a coordinate the rule constrains, or whose values overlap', () => {
        const hands = [quiz('right'), quiz('wrong', { author_answer: { action: 'check' } })];
        const constrained = splitsOf({
            principles: [betPrinciple('reads_position', { street: ['flop'], hero_position: ['BTN', 'SB'] })],
            quiz_hands: hands,
        });
        expect(constrained[0]?.separators.map((entry) => entry.slot)).not.toContain('hero_position');
        // Both hands are on the button, so position cannot be what tells them apart.
        const overlapping = splitsOf({ principles: [betPrinciple('blind', { street: ['flop'] })], quiz_hands: hands });
        expect(overlapping[0]?.separators.map((entry) => entry.slot)).not.toContain('hero_position');
    });

    it('says nothing about a rule that is never right, rather than guessing', () => {
        const splits = splitsOf({
            principles: [betPrinciple('always_wrong', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) })],
        });
        expect(splits[0]).toMatchObject({ passed: 0, failed: 1, separators: [] });
    });

    it('leaves out a principle with no failures, a hand it cannot read, and a source with no hands', () => {
        expect(splitsOf({})).toEqual([]);
        expect(splitsOf({
            quiz_hands: [quiz('bad', { situation_instance: { hero_cards: ['Ah'] }, author_answer: { action: 'check' } })],
        })).toEqual([]);
        const source = withoutQuizHands(payload());
        expect(separation(runHarness(source), source)).toEqual([]);
    });

    it('ranks the worst offender first, and breaks a tie by id', () => {
        const worst = splitsOf({
            principles: [
                betPrinciple('one_failure', { street: ['turn'] }, { rule: foldRule({ street: ['turn'] }) }),
                betPrinciple('two_failures', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) }),
            ],
            quiz_hands: [quiz('a'), quiz('b'), onTheTurn('c')],
        });
        expect(worst.map((entry) => entry.principleId)).toEqual(['two_failures', 'one_failure']);
        const tied = splitsOf({
            principles: [
                betPrinciple('zulu', { street: ['turn'] }, { rule: foldRule({ street: ['turn'] }) }),
                betPrinciple('alpha', { street: ['flop'] }, { rule: foldRule({ street: ['flop'] }) }),
            ],
            quiz_hands: [quiz('a'), onTheTurn('b')],
        });
        expect(tied.map((entry) => entry.principleId)).toEqual(['alpha', 'zulu']);
    });
});
