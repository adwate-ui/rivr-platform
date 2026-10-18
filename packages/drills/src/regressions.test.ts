import { describe, it, expect } from 'vitest';
import { cardOrThrow, type Card } from './cards/cards.ts';
import type { Action, Principle, Rule, Street } from './ontology/types.ts';
import type { ComboSet } from './range/comboSet.ts';
import { boardTags } from './boardTexture.ts';
import { classifyMadeHand } from './handClass.ts';
import { classifyRelativeStrength } from './relativeStrength.ts';
import { governingPrinciple } from './grading/arbitrate.ts';
import { resolveOutcome } from './grading/resolveAction.ts';
import { legalActions } from './grading/legalActions.ts';
import type { Scenario } from './generator/types.ts';

/**
 * Defects that once reached a reader, pinned on a small invented corpus.
 *
 * Each describe block is one class of wrong answer a human reported: a made
 * hand told to give up, the nuts folded, an answer the pad could not offer.
 * The gates (`overclaim`, `winnable`) measure the whole generated population
 * of a real encoding; this file pins the engine behaviour each fix relies on,
 * so a regression names itself instead of moving a percentage. Every rule
 * below is invented for the test and is not poker advice.
 */

const FEEDBACK = {
    correct: 'Invented for this test.',
    too_passive: 'Invented for this test.',
    too_aggressive: 'Invented for this test.',
    too_loose: 'Invented for this test.',
    too_tight: 'Invented for this test.',
};

/** A predicate rule with one answer for everything its situation admits. */
const rule = (id: string, situation: Rule['situation'], action: Action): Principle => ({
    id,
    source_id: 'src_synthetic',
    name: 'Invented rule',
    rationale: 'Invented for this test.',
    feedback: FEEDBACK,
    rule: { kind: 'predicate', situation, branches: [], default: { action } },
});

const GIVE_UP_AIR = rule('syn_give_up_air', { street: 'flop', hand_class_any: ['no_pair', 'ace_high'], draw_class_any: ['none'] }, 'check');
const BET_MADE_HANDS = rule('syn_bet_made_hands', { street: 'flop', hand_class_any: ['two_pair', 'set', 'straight', 'flush', 'full_house_plus'] }, 'bet');
const FOLD_MARGINAL_TO_SHOVE = rule('syn_fold_marginal_to_shove', {
    street: 'turn', villain_raise_size: ['all_in'], hand_class_any: ['top_pair_good_kicker', 'overpair', 'two_pair'],
    relative_strength_any: ['strong', 'medium', 'weak'],
}, 'fold');
const CALL_WITH_THE_NUTS = rule('syn_call_with_the_nuts', { street: ['turn', 'river'], relative_strength_any: ['nuts'] }, 'call');
const FOLD_WEAK_RIVER_TO_SHOVE = rule('syn_fold_weak_river_to_shove', {
    street: 'river', villain_raise_size: ['all_in'], hand_class_any: ['no_pair', 'ace_high', 'weak_pair'],
    relative_strength_any: ['strong', 'medium', 'weak'],
}, 'fold');

const CORPUS = [GIVE_UP_AIR, BET_MADE_HANDS, FOLD_MARGINAL_TO_SHOVE, CALL_WITH_THE_NUTS, FOLD_WEAK_RIVER_TO_SHOVE];
const CONTEXT = { ranges: new Map<string, ComboSet>() };

const streetFor = (boardSize: number): Street => (boardSize === 3 ? 'flop' : boardSize === 4 ? 'turn' : 'river');

/** A postflop spot, classified the way the generator classifies one. */
function spot(boardText: readonly string[], holeText: readonly [string, string], over: Partial<Scenario> = {}): Scenario {
    const board: Card[] = boardText.map(cardOrThrow);
    const hole: [Card, Card] = [cardOrThrow(holeText[0]), cardOrThrow(holeText[1])];
    const made = classifyMadeHand(hole, board);
    return {
        street: streetFor(board.length),
        holder: 'hero',
        heroPosition: 'CO',
        potType: 'single_raised',
        playerCount: 'heads_up',
        villainPositions: ['BB'],
        stackBracket: 'deep',
        postflopFacingState: 'first_to_act',
        board,
        hole,
        boardTags: boardTags(board.slice(0, 3)),
        handClass: made.handClass,
        draws: made.draws,
        relativeStrength: classifyRelativeStrength(hole, board),
        nodePath: [],
        seed: 1,
        ...over,
    };
}

const answerFor = (scenario: Scenario): { principle: string | null; action: Action | null } => {
    const governing = governingPrinciple(scenario, CORPUS, CONTEXT);
    if (governing === null) return { principle: null, action: null };
    return { principle: governing.id, action: resolveOutcome(governing, scenario, CONTEXT)?.outcome.action ?? null };
};

describe('a made flush is not told to give up', () => {
    // A give-up rule whose situation read nothing about the hand once claimed a
    // flush on a monotone flop through its catch-all default. Scoped to air,
    // it cannot.
    const flopped = spot(['Jd', 'Td', '4d'], ['Kd', '9d']);

    it('is read as the flush it is', () => {
        expect(flopped.handClass).toBe('flush');
    });

    it('is not claimed by the give-up rule', () => {
        expect(answerFor(flopped).principle).not.toBe(GIVE_UP_AIR.id);
    });

    it('is never told to check or fold', () => {
        expect(['check', 'fold']).not.toContain(answerFor(flopped).action);
    });
});

describe('monsters are not checked by rules written about air', () => {
    // The expected class is asserted first: a fixture that does not hold the
    // hand it claims would otherwise pass while testing nothing.
    it.each([
        ['a full house', ['6c', '6d', '6s'], ['4s', '6h'], 'full_house_plus'],
        ['a straight', ['8h', '6h', '9h'], ['7d', 'Td'], 'straight'],
        ['a set', ['Th', '7h', '9h'], ['7d', '7s'], 'set'],
    ] as const)('%s is never given up', (_label, boardText, holeText, expected) => {
        const scenario = spot(boardText, holeText);
        expect(scenario.handClass).toBe(expected);
        expect(['check', 'fold']).not.toContain(answerFor(scenario).action);
    });
});

describe('a fold rule does not fold the top of its own range', () => {
    // A fold-to-a-big-shove rule once folded two pair that beat 99% of
    // holdings: its premise is marginal hands, and without a strength scope it
    // claimed the near-nuts too.
    const deepTurn = (boardText: readonly string[], holeText: readonly [string, string]): Scenario =>
        spot(boardText, holeText, {
            stackBracket: 'very_deep',
            potType: 'three_bet',
            postflopFacingState: 'facing_bet',
            villainRaiseSize: 'all_in',
        });

    it('leaves the near-nuts alone rather than folding it', () => {
        // Top two pair on a board only sets beat, and no flush or straight is possible.
        const nutty = deepTurn(['3h', 'Kh', '6c', '9d'], ['Kc', '9c']);
        expect(nutty.relativeStrength).toBe('nuts');
        expect(answerFor(nutty)).toEqual({ principle: CALL_WITH_THE_NUTS.id, action: 'call' });
    });

    it('still folds the marginal hand the rule is about', () => {
        const marginal = deepTurn(['Ad', '9s', '4c', '2h'], ['Ah', 'Qd']);
        expect(marginal.handClass).toBe('top_pair_good_kicker');
        expect(answerFor(marginal)).toEqual({ principle: FOLD_MARGINAL_TO_SHOVE.id, action: 'fold' });
    });
});

describe('a board that plays itself is never folded', () => {
    /**
     * When the five community cards are themselves the best hand, `hand_class`
     * reads `no_pair` — correctly, the hero's cards add nothing — while every
     * player holds that same unbeatable hand. A river fold rule reading the
     * class and not the strength told the reader to fold a guaranteed chop.
     */
    const river = { postflopFacingState: 'facing_bet', villainRaiseSize: 'all_in' } as const;
    const broadwayOnBoard = spot(['Td', 'Kc', 'Qs', 'Ah', 'Jc'], ['7d', '3h'], river);

    it('reads the hero as holding nothing, and as holding the nuts', () => {
        // Both are true at once, and that is the whole trap.
        expect(broadwayOnBoard.handClass).toBe('no_pair');
        expect(broadwayOnBoard.relativeStrength).toBe('nuts');
    });

    it('is not folded by any rule', () => {
        expect(answerFor(broadwayOnBoard).action).not.toBe('fold');
    });

    it('still folds the same spot when the board is not the best hand', () => {
        const ordinary = spot(['Jh', '4c', 'Qh', '2s', '8d'], ['7d', 'Kh'], river);
        expect(ordinary.relativeStrength).not.toBe('nuts');
        expect(answerFor(ordinary)).toEqual({ principle: FOLD_WEAK_RIVER_TO_SHOVE.id, action: 'fold' });
    });
});

describe('the big blind can say what a limped-pot rule asks for', () => {
    // A rule that checks outside its raising range and raises inside it needs
    // both buttons. The pad once offered only fold, call and raise there, then
    // briefly only check and bet; each made half the rule unanswerable.
    it('offers both check and raise facing a limp', () => {
        const actions = legalActions({ street: 'preflop', preflopFacingState: 'facing_limp', heroPosition: 'BB' });
        expect(actions).toContain('check');
        expect(actions).toContain('raise');
    });
});
