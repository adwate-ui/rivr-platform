import { describe, it, expect } from 'vitest';
import { type Card, cardOrThrow as card } from './cards/cards.ts';
import type { Principle, Situation } from './ontology/types.ts';
import type { Scenario } from './generator/types.ts';
import { classifyMadeHand } from './handClass.ts';
import { emptyCombos } from './range/comboSet.ts';
import {
    isWholeRange, postflopStrategy, representativeFor, STRATEGY_CLASSES, STRATEGY_DRAWS, type StrategyRow,
} from './strategy.ts';

/**
 * What the source does here with every kind of hand.
 *
 * The question this answers is the one a reader asked out loud: *why is the
 * recommendation the same whatever I hold?* It was two different things wearing
 * the same face — a rule that deliberately answers every hand the same way and
 * a rule that had simply never looked at the cards — and nothing on screen
 * could tell them apart.
 *
 * What is pinned: a row is the SAME computation as the verdict, so it cannot
 * disagree with it; a kind of hand nobody answers is absent rather than
 * invented; and a representative is chosen so the row is about the hand it
 * claims to be about, which postflop is not automatic the way it is preflop.
 */

const flop = ['Ac', '6h', '2h'].map(card);
const context = new Map([['rs', emptyCombos()]]);

const rule = (id: string, action: 'bet' | 'check' | 'raise', situation: Situation): Principle => ({
    id,
    source_id: 's',
    name: id,
    rationale: 'r',
    feedback: { correct: 'c' },
    rule: {
        kind: 'predicate',
        situation: { street: ['flop'], ...situation },
        branches: [],
        default: { action, sizing: 'unspecified' },
    },
});

/** A stand-in the board is known to have; a miss here is a broken test. */
const standIn = (board: readonly Card[], want: Parameters<typeof representativeFor>[1], isDraw: boolean): readonly [Card, Card] => {
    const hole = representativeFor(board, want, isDraw);
    if (hole === undefined) throw new Error(`no ${want} on this board`);
    return hole;
};

const spot = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'flop',
    heroPosition: 'BB',
    villainPosition: 'BTN',
    villainPositions: ['BTN'],
    potType: 'limped',
    playerCount: 'heads_up',
    stackBracket: 'standard',
    effectiveStackBb: 100,
    postflopFacingState: 'facing_bet',
    board: flop,
    hole: [card('Kd'), card('9d')],
    holder: 'hero',
    boardTags: [],
    handClass: 'no_pair',
    draws: ['none'],
    nodePath: [],
    seed: 1,
    ...over,
});

describe('a hand that stands for a kind of hand', () => {
    it('picks a made hand with no draw attached, so the row is about the made hand', () => {
        const hole = standIn(flop, 'second_pair', false);
        const made = classifyMadeHand(hole, flop);
        expect(made.handClass).toBe('second_pair');
        expect(made.draws).toEqual(['none']);
    });

    it('picks a draw with nothing made, and never one outranked by a stronger draw', () => {
        // `classifyDraws` lists a combo draw alongside its components, so "the
        // first hand holding a gutshot" is a combo draw about a third of the
        // time — and a gutshot row showing 5♥4♥ on a two-heart flop is a row
        // about the wrong hand.
        const hole = standIn(flop, 'gutshot', true);
        const made = classifyMadeHand(hole, flop);
        expect(made.handClass).toBe('no_pair');
        expect(made.draws).toContain('gutshot');
        expect(made.draws).not.toContain('flush_draw');
        expect(made.draws).not.toContain('combo_draw');
    });

    it('falls back to any example when the board cannot make the class without a draw', () => {
        // On 8♥7♥6♥ every two pair also holds a flush draw or a straight draw,
        // so the clean pass finds nothing and the row would vanish — reading as
        // "the source says nothing here" when the source says plenty.
        const monotone = ['8h', '7h', '6h'].map(card);
        const hole = standIn(monotone, 'two_pair', false);
        expect(classifyMadeHand(hole, monotone).handClass).toBe('two_pair');
    });

    it('finds nothing when the board cannot make the class at all', () => {
        // A rainbow river leaves no card to come and no suit to draw to.
        const river = ['Ac', '6h', '2s', 'Td', '4c'].map(card);
        expect(representativeFor(river, 'flush_draw', true)).toBeUndefined();
    });
});

describe('what the source does here', () => {
    it('draws a row per kind of hand the source answers, and none for the rest', () => {
        // Scoped to the hands its source talks about, and silent on the rest.
        const narrow = rule('attack_the_weak', 'raise', {
            hand_class_any: ['no_pair', 'weak_pair', 'second_pair'],
        });
        const { made, draws } = postflopStrategy(spot(), [narrow], context);
        expect(made.map((row) => row.key)).toEqual(['second_pair', 'weak_pair', 'no_pair']);
        // A set is absent, not folded: the source does not answer it here.
        expect(made.some((row) => row.key === 'set')).toBe(false);
        // The draws ARE answered, and by that same rule: a hand drawing to a
        // flush has made no pair, which is a class the rule speaks for.
        expect(draws.map((row) => row.action)).toEqual(['raise', 'raise', 'raise']);
    });

    it('marks the row the reader is actually in, and shows their own cards on it', () => {
        const anything = rule('anything', 'check', { hand_class_any: [...STRATEGY_CLASSES] });
        const { made } = postflopStrategy(spot(), [anything], context);
        const yours = made.filter((row) => row.yours);
        expect(yours.map((row) => row.key)).toEqual(['no_pair']);
        // Not a stand-in: the row badged "Yours" is the hand the reader holds,
        // so it agrees with the verdict above it by construction.
        expect(yours[0]?.hole).toEqual([card('Kd'), card('9d')]);
    });

    it('marks a draw row when the hero holds that draw', () => {
        const drawn = spot({ hole: [card('Kh'), card('Qh')], draws: ['flush_draw'] });
        const anything = rule('anything', 'check', { draw_class_any: [...STRATEGY_DRAWS] });
        const { draws } = postflopStrategy(drawn, [anything], context);
        expect(draws.find((row) => row.key === 'flush_draw')?.yours).toBe(true);
        expect(draws.find((row) => row.key === 'gutshot')?.yours).toBe(false);
    });

    it('answers each row the way the verdict would, from whichever rule governs it', () => {
        // Two rules, split by hand: the table must show the split rather than
        // the drawn rule's answer everywhere.
        const value = rule('value', 'bet', { hand_class_any: ['set', 'two_pair'] });
        const air = rule('air', 'check', { hand_class_any: ['no_pair'] });
        const { made } = postflopStrategy(spot(), [value, air], context);
        expect(made.find((row) => row.key === 'set')?.action).toBe('bet');
        expect(made.find((row) => row.key === 'set')?.principleId).toBe('value');
        expect(made.find((row) => row.key === 'no_pair')?.action).toBe('check');
    });

    it('says nothing before the flop, where the grid is the right picture', () => {
        const preflop = spot({ street: 'preflop', board: [], hole: [card('Ac'), card('Kc')] });
        expect(postflopStrategy(preflop, [rule('x', 'bet', {})], context)).toEqual({ made: [], draws: [] });
    });

    it('has no rows at all when nothing governs the spot', () => {
        expect(postflopStrategy(spot(), [], context)).toEqual({ made: [], draws: [] });
    });
});

describe('whether the answer moves at all', () => {
    const aces: readonly [Card, Card] = [card('Ac'), card('Ad')];
    const row = (action: 'bet' | 'check', sizing?: 'large'): StrategyRow => ({
        key: 'set', label: 'a set', hole: aces, action, sizing, principleId: 'p', yours: false,
    });

    it('is a whole-range play when every answered row agrees', () => {
        expect(isWholeRange([row('check'), row('check')])).toBe(true);
    });

    it('is not one when the size differs, let alone the action', () => {
        expect(isWholeRange([row('bet'), row('bet', 'large')])).toBe(false);
        expect(isWholeRange([row('bet'), row('check')])).toBe(false);
    });

    it('says nothing off a single row, which is evidence of neither', () => {
        expect(isWholeRange([row('check')])).toBe(false);
        expect(isWholeRange([])).toBe(false);
    });
});
