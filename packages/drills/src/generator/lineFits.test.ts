import { describe, it, expect } from 'vitest';
import { cardOrThrow as card } from '../cards/cards.ts';
import { lineFits } from './lineFits.ts';
import type { Scenario } from './types.ts';
import type { Outcome, Principle, Situation } from '../ontology/types.ts';
import { emptyCombos } from '../range/comboSet.ts';

/**
 * The hero's own earlier streets, against the source's own rules.
 *
 * `playable` answers this for preflop. Nothing answered it for the flop or the
 * turn, so a turn spot whose line reads "you bet the flop and they called"
 * dealt any hand the TURN rule wanted — including hands the source's own flop
 * rules say to check. Measured at 41 of 4,080 postflop spots.
 *
 * What is pinned here: the check rewinds to the hero's earlier decision and
 * asks the source; it accepts the source's answer and the alternatives the
 * source itself calls acceptable; it re-derives everything the CARDS decide
 * from the shorter board rather than judging the flop by the river; and it
 * imposes nothing where nothing governs.
 */


const spot = (over: Partial<Scenario> = {}): Scenario => ({
    street: 'turn',
    heroPosition: 'CO',
    villainPosition: 'BB',
    villainPositions: ['BB'],
    effectiveStackBb: 100,
    potType: 'single_raised',
    playerCount: 'heads_up',
    stackBracket: 'standard',
    postflopFacingState: 'facing_check',
    board: ['Qc', 'Jd', '8h', '2s'].map(card),
    hole: [card('7c'), card('5d')],
    holder: 'hero',
    boardTags: [],
    nodePath: ['hero_flop_bet', 'villain_flop_call'],
    potBb: 20,
    seed: 1,
    ...over,
});

/** A principle that checks every spot its situation admits. */
const ruleFor = (id: string, situation: Situation): Principle => ({
    id,
    source_id: 's',
    name: id,
    rationale: 'r',
    feedback: { correct: 'c' },
    rule: { kind: 'predicate', situation, branches: [], default: { action: 'check', sizing: 'unspecified' } },
});

/** A principle that answers every flop spot with `action`. */
const flopRule = (id: string, action: 'bet' | 'check', over: Partial<Outcome> = {}): Principle => ({
    ...ruleFor(id, { street: ['flop'] }),
    rule: { kind: 'predicate', situation: { street: ['flop'] }, branches: [], default: { action, sizing: 'unspecified', ...over } },
});

const context = { ranges: new Map([['rs', emptyCombos()]]) };

describe('the hero’s earlier streets', () => {
    it('rejects a hand the source would not have bet the flop with', () => {
        const fits = lineFits([flopRule('check_it', 'check')], context);
        expect(fits(spot())).toBe(false);
    });

    it('keeps a hand whose earlier action IS the source’s answer', () => {
        const fits = lineFits([flopRule('bet_it', 'bet')], context);
        expect(fits(spot())).toBe(true);
    });

    it('accepts an alternative the source itself calls acceptable', () => {
        const fits = lineFits([flopRule('check_it', 'check', {
            acceptable_alternatives: [{ action: 'bet' }],
        })], context);
        expect(fits(spot())).toBe(true);
    });

    it('ignores an alternative that states only a size', () => {
        // `acceptable_alternatives` may narrow the sizing of the same action,
        // in which case it names no action of its own and adds nothing here.
        const fits = lineFits([flopRule('check_it', 'check', {
            acceptable_alternatives: [{ sizing: 'large' }],
        })], context);
        expect(fits(spot())).toBe(false);
    });

    it('counts an all-in as the bet the story says it was', () => {
        const fits = lineFits([flopRule('shove_it', 'bet', { sizing: 'all_in' })], context);
        expect(fits(spot({ nodePath: ['hero_flop_all_in', 'villain_flop_call'] }))).toBe(true);
    });

    it('imposes nothing where the source governs nothing', () => {
        expect(lineFits([], context)(spot())).toBe(true);
    });

    it('imposes nothing on a step whose verb it has no word for', () => {
        const fits = lineFits([flopRule('check_it', 'check')], context);
        expect(fits(spot({ nodePath: ['hero_flop_muses'] }))).toBe(true);
    });

    it('leaves preflop, the villain and the pending street to the checks that own them', () => {
        const fits = lineFits([flopRule('check_it', 'check')], context);
        // Preflop is `playable`'s; the villain's actions are not the hero's to
        // justify; and the decision street is the question, not a premise.
        expect(fits(spot({ nodePath: ['hero_preflop_raise'] }))).toBe(true);
        expect(fits(spot({ nodePath: ['villain_flop_bet'] }))).toBe(true);
        expect(fits(spot({ street: 'flop', board: ['Qc', 'Jd', '8h'].map(card), nodePath: ['hero_flop_bet'] }))).toBe(true);
        // A step with no actor names nobody to hold to it.
        expect(fits(spot({ nodePath: ['flop_bet'] }))).toBe(true);
    });

    it('judges the flop by the flop, not by the river', () => {
        // 7-5 is nothing on Q-J-8 and a straight once the 9 and the 6 land, so
        // a flop rule about unmade hands governs the rewound decision and a
        // rewind that carried the river's classification would never reach it.
        // Judging the flop bet by what the river made of it is the hindsight
        // this module exists to keep out.
        const unmadeOnly = ruleFor('give_up_air', { street: ['flop'], hand_class_any: ['no_pair'] });
        expect(lineFits([unmadeOnly], context)(spot({
            street: 'river',
            board: ['Qc', 'Jd', '8h', '9s', '6d'].map(card),
            nodePath: ['hero_flop_bet', 'villain_flop_call'],
        }))).toBe(false);
    });

    it('reads the source’s own stack-to-pot boundaries', () => {
        // A rule scoped to a low SPR governs the rewound flop only if the
        // brackets it is bucketed by are the source's. With the default brackets
        // a 100bb stack in an 8bb flop pot is SPR high; a source that calls
        // anything up to 20 "low" makes the same spot low, and its rule then
        // has something to say about the flop bet.
        const lowOnly = ruleFor('low_spr', { street: ['flop'], spr_bracket: ['low'] });
        expect(lineFits([lowOnly], context)(spot())).toBe(true);
        expect(lineFits([lowOnly], context, { low_max: 20 })(spot())).toBe(false);
    });

    it('reads the facing state off the steps in front of the hero', () => {
        const facing = (situation: Situation): Principle => ruleFor('f', { street: ['flop'], ...situation });
        // Nothing in front of the hero, and the hero is not the earliest seat
        // in the pot — so it was checked to them.
        const checkedTo = lineFits([facing({ postflop_facing_state: ['facing_check'] })], context);
        expect(checkedTo(spot())).toBe(false);
        // The hero on the small blind opens the street.
        const first = lineFits([facing({ postflop_facing_state: ['first_to_act'] })], context);
        expect(first(spot({ heroPosition: 'SB', villainPosition: 'BTN', villainPositions: ['BTN'] }))).toBe(false);
        // A villain bet in front of the hero's call is a bet the hero faced.
        const bet = lineFits([facing({ postflop_facing_state: ['facing_bet'] })], context);
        expect(bet(spot({ nodePath: ['villain_flop_bet', 'hero_flop_call'] }))).toBe(false);
        // A villain raise, likewise, and a shove is a raise.
        const raise = lineFits([facing({ postflop_facing_state: ['facing_raise'] })], context);
        expect(raise(spot({ nodePath: ['hero_flop_bet', 'villain_flop_raise', 'hero_flop_call'] }))).toBe(false);
        expect(raise(spot({ nodePath: ['hero_flop_bet', 'villain_flop_all_in', 'hero_flop_call'] }))).toBe(false);
        // A villain call is not something to answer: the hero is acting into
        // a street nobody has bet, which is the check's question.
        const called = lineFits([facing({ postflop_facing_state: ['facing_check'] })], context);
        expect(called(spot({ nodePath: ['villain_flop_call', 'hero_flop_bet'] }))).toBe(false);
        // And a villain check the hero answered.
        const checked = lineFits([facing({ postflop_facing_state: ['facing_check'] })], context);
        expect(checked(spot({ nodePath: ['villain_flop_check', 'hero_flop_bet'] }))).toBe(false);
        // Only the villain's own steps name a state; the hero's do not.
        const afterOwnStep = lineFits([facing({ postflop_facing_state: ['facing_check'] })], context);
        expect(afterOwnStep(spot({ nodePath: ['hero_flop_check', 'hero_flop_bet'] }))).toBe(false);
    });

    it('reads what the TURN card changed when the rewind is to the turn', () => {
        // A river spot whose line has a hero turn bet rewinds to a four-card
        // board, and the turn rule that governs it is scoped to what that card
        // did — here the ten, which put four to a straight out.
        const brickOnly = ruleFor('check_a_four_straight', { street: ['turn'], runout_any: ['four_straight'] });
        expect(lineFits([brickOnly], context)(spot({
            street: 'river',
            board: ['Qc', 'Jd', '9h', 'Ts', '2d'].map(card),
            nodePath: ['hero_turn_bet', 'villain_turn_call'],
        }))).toBe(false);
    });

    it('says nothing about a pot whose type the spot never stated', () => {
        // No pot type is no pot model, so there is no stack-to-pot to bucket
        // and no estimate to show — the rewound spot carries neither.
        const fits = lineFits([flopRule('bet_it', 'bet')], context);
        expect(fits(spot({ potType: undefined }))).toBe(true);
        expect(fits(spot({ effectiveStackBb: undefined }))).toBe(true);
    });
});
