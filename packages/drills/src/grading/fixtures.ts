/**
 * Builders for the grading tests: one spot and one principle with sensible
 * defaults, overridden field by field, so each test states only what it is
 * about. Every rule here is synthetic; none of it is poker advice.
 */

import { cardOrThrow as card, cardsOrThrow as cards } from '../cards/cards.ts';
import type { Principle, Situation } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { resolveOutcome } from './resolveAction.ts';
import type { Resolution, ResolveContext } from './resolution.ts';



/** A flop spot: top pair, good kicker, checked to the hero on the button. */
export const scenario = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'flop',
    heroPosition: 'BTN',
    villainPosition: 'BB',
    potType: 'single_raised',
    playerCount: 'heads_up',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    stackBracket: 'standard',
    postflopFacingState: 'facing_check',
    board: cards('Ah7c2d'),
    hole: [card('As'), card('Kd')],
    holder: 'hero',
    boardTags: ['rainbow', 'disconnected', 'high', 'ace_high'],
    handClass: 'top_pair_good_kicker',
    draws: ['none'],
    relativeStrength: 'strong',
    nodePath: [],
    seed: 1,
    ...over,
});

/** A flop rule that bets top pair with a good kicker and checks everything else. */
export const principle = (over: Partial<Principle> = {}): Principle => ({
    id: 'pr',
    source_id: 'src',
    name: 'Test',
    rule: {
        kind: 'predicate',
        situation: { street: 'flop' },
        branches: [{ when: { hand_class_any: ['top_pair_good_kicker'] }, then: { action: 'bet', sizing: 'medium' } }],
        default: { action: 'check' },
    },
    rationale: 'Because.',
    feedback: { correct: 'Right.', too_passive: 'Bet it.' },
    ...over,
});

/** A context with no ranges unless the test gives some. */
export const context = (over: Partial<ResolveContext> = {}): ResolveContext => ({
    ranges: new Map(),
    ...over,
});

/**
 * `resolveOutcome` for a rule that definitely answers. It returns null when a
 * rule abstains; asserting that once here keeps the null out of assertions that
 * are about something else. Abstention has its own tests.
 */
export function resolved(subject: Principle, spot: Scenario, resolveContext: ResolveContext): Resolution {
    const resolution = resolveOutcome(subject, spot, resolveContext);
    if (resolution === null) throw new Error(`${subject.id} abstained`);
    return resolution;
}

/** A turn spot facing a large bet, for the arbitration tests. */
export const turnSpot = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'turn',
    heroPosition: 'BTN',
    potType: 'single_raised',
    playerCount: 'heads_up',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    stackBracket: 'standard',
    postflopFacingState: 'facing_bet',
    villainRaiseSize: 'large',
    villainType: 'opp_nit',
    board: [card('Qs'), card('7c'), card('2d'), card('9h')],
    hole: [card('Ah'), card('Kd')],
    holder: 'hero',
    boardTags: ['rainbow'],
    nodePath: [],
    seed: 0,
    ...over,
});

/** A principle that always bets inside `situation`: arbitration only asks which one is narrower. */
export const alwaysBets = (id: string, situation: Situation, over: Partial<Principle> = {}): Principle => ({
    id,
    source_id: 'src',
    name: id,
    rule: {
        kind: 'predicate',
        situation,
        branches: [],
        default: { action: 'bet', sizing: 'medium' },
    },
    rationale: 'Synthetic fixture.',
    feedback: { correct: 'x', too_loose: 'x' },
    ...over,
});
