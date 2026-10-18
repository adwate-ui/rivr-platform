import { describe, it, expect } from 'vitest';
import type { ClassifyRule, Principle } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import {
    answerKindOf, isActionResolution, resolveClassify, resolveOutcome,
    type AnyResolution, type ResolveContext,
} from './resolve.ts';
import { rankCandidates } from './arbitrate.ts';

/**
 * Resolving a rule whose answer is a label (ontology 1.9).
 *
 * Fixtures are synthetic, as everywhere else in grading: the mechanism is which
 * branch wins and what happens when none does, and dressing that up as poker
 * advice would test the same code while inviting the fixtures to be read as
 * recommendations.
 *
 * The two things worth stating out loud, because both are easy to get wrong in
 * a way nothing complains about:
 *
 *  - a classify rule must be invisible to the ACTION path, not answer it badly;
 *  - abstention has to work the same way it does for an action rule, or a
 *    classify rule quietly becomes the catch-all that answers every spot its
 *    situation admits.
 */


/** A resolution the test expects to exist. */
const present = <T>(value: T | null): T => {
    if (value === null) throw new Error('Expected a resolution');
    return value;
};

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
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
    ...over,
});

const LABELS = [
    { id: 'strong_fit', label: 'Strong fit' },
    { id: 'weak_fit', label: 'Weak fit' },
];

const classifyRule = (over: Partial<ClassifyRule> = {}): ClassifyRule => ({
    kind: 'classify',
    situation: { street: ['flop'] },
    labels: LABELS,
    perspective: 'hero',
    prompt: 'Strong fit or weak fit?',
    branches: [],
    ...over,
});

const principle = (rule: ClassifyRule, over: Partial<Principle> = {}): Principle => ({
    id: 'pr_classify',
    source_id: 'src',
    name: 'Fit',
    rule,
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', wrong_label: 'x' },
    ...over,
});

const context: ResolveContext = { ranges: new Map() };

describe('resolving a classify rule', () => {
    it('is a classify question, and the action path cannot see it', () => {
        const rule = classifyRule({ default: { label: 'weak_fit' } });
        expect(answerKindOf(rule)).toBe('classify');

        // Not "answers badly" — invisible. `resolveOutcome` returns the same
        // null an abstaining rule returns, which is what lets arbitration hand
        // the spot on rather than grading a label against an action.
        expect(resolveOutcome(principle(rule), scenario(), context)).toBeNull();
        expect(rankCandidates(scenario(), [principle(rule)])).toEqual([]);
    });

    it('takes the first branch that matches and records the ones behind it', () => {
        const rule = classifyRule({
            branches: [
                { when: { hero_position: ['BTN'] }, then: { label: 'strong_fit' } },
                { when: { player_count: ['heads_up'] }, then: { label: 'weak_fit' } },
            ],
        });
        const resolved = resolveClassify(principle(rule), scenario(), context);
        expect(resolved?.outcome.label).toBe('strong_fit');
        expect(resolved?.provenance).toEqual({ kind: 'branch', detail: 'branch 0' });
        // The second branch matched too. It is recorded, not applied.
        expect(resolved?.shadowed).toEqual([{ kind: 'branch', detail: 'branch 1' }]);
    });

    it('falls through to the default when no branch matches', () => {
        const rule = classifyRule({
            branches: [{ when: { hero_position: ['SB'] }, then: { label: 'strong_fit' } }],
            default: { label: 'weak_fit' },
        });
        const resolved = resolveClassify(principle(rule), scenario(), context);
        expect(resolved?.outcome.label).toBe('weak_fit');
        expect(resolved?.provenance).toEqual({ kind: 'default', detail: 'no branch matched' });
        expect(resolved?.shadowed).toEqual([]);
    });

    it('abstains where it has no default, exactly as an action rule does', () => {
        const rule = classifyRule({
            branches: [{ when: { hero_position: ['SB'] }, then: { label: 'strong_fit' } }],
        });
        // Without this a classify rule becomes a catch-all answering every spot
        // its situation admits, which is the scope error the optional default
        // was introduced to prevent on the action side.
        expect(resolveClassify(principle(rule), scenario(), context)).toBeNull();
    });

    it('reports an override the same way the action path does', () => {
        const base = classifyRule({ default: { label: 'strong_fit' } });
        const override = classifyRule({ default: { label: 'weak_fit' } });
        const resolved = resolveClassify(
            principle(base, { status: 'overridden', override_rule: override }),
            scenario(),
            context,
        );
        expect(resolved?.outcome.label).toBe('weak_fit');
        expect(resolved?.shadowed).toContainEqual({
            kind: 'override', detail: 'base rule replaced by your override',
        });
    });

    it('declines a principle that is not a classify rule at all', () => {
        const action: Principle = {
            id: 'pr_action',
            source_id: 'src',
            name: 'Bet',
            rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'bet' } },
            rationale: 'Synthetic fixture.',
            feedback: { correct: 'x' },
        };
        expect(resolveClassify(action, scenario(), context)).toBeNull();
    });

    it('tells the two kinds of resolution apart', () => {
        const label: AnyResolution = present(resolveClassify(
            principle(classifyRule({ default: { label: 'strong_fit' } })), scenario(), context,
        ));
        const action: AnyResolution = present(resolveOutcome(
            {
                id: 'pr_action',
                source_id: 'src',
                name: 'Bet',
                rule: { kind: 'predicate', situation: {}, branches: [], default: { action: 'bet' } },
                rationale: 'Synthetic fixture.',
                feedback: { correct: 'x' },
            },
            scenario(),
            context,
        ));

        expect(isActionResolution(label)).toBe(false);
        expect(isActionResolution(action)).toBe(true);
        // And the guard narrows, so this reads `.action` without a cast.
        if (isActionResolution(action)) expect(action.outcome.action).toBe('bet');
    });

    it('is a candidate once the question being asked is a classify one', () => {
        const rule = classifyRule({ default: { label: 'weak_fit' } });
        const ranked = rankCandidates(scenario(), [principle(rule)], {
            ranges: new Map(), answerKind: 'classify',
        });
        expect(ranked.map((entry) => entry.principle.id)).toEqual(['pr_classify']);
    });
});
