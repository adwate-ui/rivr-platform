import { describe, it, expect } from 'vitest';
import type { CountRule, Principle } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { expandRangeSets } from '../range/expand.ts';
import { answerKindOf, resolveCount, resolveOutcome, type CountResolution, type ResolveContext } from './resolve.ts';
import { rankCandidates } from './arbitrate.ts';
import { gradeAnswer, gradeCount, AnswerKindMismatchError } from './grade.ts';

/**
 * Resolving and grading a count (ontology 2.0).
 *
 * A count is the only answer kind the engine works out for itself, so the thing
 * worth checking is that it arrives at a number counted independently by hand.
 * The fixture is invented: [QQ-99, AJs-ATs, KJs, AJo] is 48 combos as dealt and
 * 40 once J♣8♦3♠ is dead (the J♣ takes three JJ, one AJs, one KJs and three AJo
 * combos). Top pair or better is the JJ set (3), the QQ overpair (6) and the
 * jacks with an ace or king kicker (3 + 3 + 9): 24 of 40.
 */


const RANGES = expandRangeSets([
    { id: 'rs_value', hands: ['QQ-99', 'AJs-ATs', 'KJs', 'AJo'] },
]);
const context: ResolveContext = { ranges: RANGES };

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'flop',
    heroPosition: 'BTN',
    potType: 'three_bet',
    playerCount: 'heads_up',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    stackBracket: 'standard',
    postflopFacingState: 'facing_check',
    villainRaiseSize: 'large',
    villainType: 'opp_nit',
    board: [card('Jc'), card('8d'), card('3s')],
    hole: [card('7h'), card('2s')],
    holder: 'hero',
    boardTags: ['rainbow'],
    nodePath: [],
    seed: 0,
    ...over,
});

const countRule = (over: Partial<CountRule> = {}): CountRule => ({
    kind: 'count',
    situation: { street: ['flop'] },
    range_set_id: 'rs_value',
    dead_cards: 'board',
    filter: { kind: 'hand_class_min', hand_class: 'top_pair_weak_kicker' },
    prompt: 'How many combinations make top pair or better?',
    ...over,
});

const principle = (rule: CountRule): Principle => ({
    id: 'pr_count',
    source_id: 'src',
    name: 'Top pair or better',
    rule,
    rationale: 'Synthetic fixture over an invented range.',
    feedback: { correct: 'x', too_few: 'x', too_many: 'x' },
});

/** A count resolution the test expects to exist. */
const resolvedFor = (rule: CountRule): CountResolution => {
    const resolved = resolveCount(principle(rule), scenario(), context);
    if (resolved === null) throw new Error('The count rule declined');
    return resolved;
};

describe('resolving a count', () => {
    it('works out the number counted by hand', () => {
        expect(resolvedFor(countRule()).outcome).toMatchObject({ value: 24, of: 40 });
    });

    it('says the answer was computed rather than authored', () => {
        // Every other kind resolves to something a person wrote in the JSON.
        // This one resolves to what the range actually holds, and the
        // provenance has to say so or a reader of a report cannot tell.
        const resolved = resolvedFor(countRule());
        expect(resolved.provenance.kind).toBe('computed');
        expect(resolved.provenance.detail).toContain('rs_value');
    });

    it('is a count question, and the action path cannot see it', () => {
        const rule = countRule();
        expect(answerKindOf(rule)).toBe('count');
        expect(resolveOutcome(principle(rule), scenario(), context)).toBeNull();
        expect(rankCandidates(scenario(), [principle(rule)])).toEqual([]);
        expect(rankCandidates(scenario(), [principle(rule)], { ...context, answerKind: 'count' }))
            .toHaveLength(1);
    });

    it('declines when the range it points at is missing', () => {
        // An authoring fault the validator catches first. Counting an empty set
        // to zero and reporting that as the source's answer would be worse than
        // declining: the number would look like an answer.
        expect(resolveCount(principle(countRule({ range_set_id: 'nope' })), scenario(), context))
            .toBeNull();
    });

    it('reports an override the same way the other kinds do', () => {
        const base = countRule({ filter: { kind: 'total' } });
        const override = countRule();
        const resolved = resolveCount(
            { ...principle(base), status: 'overridden', override_rule: override },
            scenario(), context,
        );
        // The override's filter, not the base's.
        expect(resolved?.outcome.value).toBe(24);
        expect(resolved?.shadowed).toContainEqual({
            kind: 'override', detail: 'base rule replaced by your override',
        });
    });

    it('declines a principle that is not a count rule', () => {
        const action: Principle = {
            id: 'pr_action',
            source_id: 'src',
            name: 'Bet',
            rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'bet' } },
            rationale: 'Synthetic fixture.',
            feedback: { correct: 'x' },
        };
        expect(resolveCount(action, scenario(), context)).toBeNull();
    });

    it('counts what the rule says is dead, not what it guesses', () => {
        // The same range and board, counted three ways. Sources move between
        // these readings freely, which is why the rule states it.
        const withBoard = resolvedFor(countRule());
        const withNothing = resolvedFor(countRule({ dead_cards: 'none', filter: { kind: 'total' } }));
        expect(withBoard.outcome.of).toBe(40);
        expect(withNothing.outcome.value).toBe(48);

        // With the hero holding the A♥, four more combos are gone: A♥J♥, A♥T♥,
        // and A♥J♦ and A♥J♠ (A♥J♣ was already dead): 40 - 4 = 36.
        const withHero = resolveCount(
            principle(countRule({ dead_cards: 'hero', filter: { kind: 'total' } })),
            scenario({ hole: [card('Ah'), card('2s')] }), context,
        );
        expect(withHero?.outcome.value).toBe(36);
    });
});

describe('grading a count', () => {
    const resolved = (): CountResolution => resolvedFor(countRule());

    it('is correct on the number itself', () => {
        expect(gradeCount(24, resolved())).toMatchObject({ klass: 'correct', correct: true });
    });

    it('says which direction the miss ran in', () => {
        // A pair, unlike `wrong_label`: too few and too many are different
        // mistakes about a range, and a source can say something useful about
        // each.
        expect(gradeCount(20, resolved())).toMatchObject({ klass: 'too_few', correct: false });
        expect(gradeCount(30, resolved())).toMatchObject({ klass: 'too_many', correct: false });
    });

    it('is exact unless the source itself hedged', () => {
        expect(gradeCount(25, resolved()).correct).toBe(false);

        const loose = resolvedFor(countRule({ tolerance: 2 }));
        expect(gradeCount(25, loose).correct).toBe(true);
        expect(gradeCount(22, loose).correct).toBe(true);
        expect(gradeCount(27, loose)).toMatchObject({ klass: 'too_many', correct: false });
    });

    it('goes through the dispatcher like the other kinds', () => {
        const rule = countRule();
        expect(gradeAnswer({ kind: 'count', value: 24 }, resolved(), scenario(), principle(rule)))
            .toMatchObject({ klass: 'correct' });
    });

    it('refuses to grade a count against a question that was not one', () => {
        const action = {
            kind: 'action' as const,
            outcome: { action: 'bet' as const },
            provenance: { kind: 'default' as const, detail: 'x' },
            shadowed: [],
        };
        expect(() => gradeAnswer(
            { kind: 'count', value: 24 }, action, scenario(), principle(countRule()),
        )).toThrow(AnswerKindMismatchError);
    });
});
