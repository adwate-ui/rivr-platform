import { describe, it, expect } from 'vitest';
import { parseStep } from '../nodePath.ts';
import { heroPreflopAction, impliedAggressor, type PreflopLineInput } from './preflopLine.ts';

/**
 * What the hero did preflop.
 *
 * Two readers depend on this answer and must not disagree: the hand history,
 * which names a preflop raiser before it can tell the story, and the
 * generator, which deals the hero a hand the source would have played that
 * way. The spots that made it necessary were the ones where the story said
 * "under the gun raises" and the cards said Q-4 offsuit.
 */

const spot = (over: Partial<PreflopLineInput> = {}): PreflopLineInput => ({
    street: 'turn',
    potType: 'single_raised',
    postflopFacingState: 'facing_check',
    nodePath: [],
    ...over,
});

const steps = (path: readonly string[]) => path.map(parseStep);

describe('who took the initiative', () => {
    it('reads the first postflop step that implies one', () => {
        expect(impliedAggressor('facing_check', steps(['hero_flop_bet']))).toBe('hero');
        expect(impliedAggressor('facing_check', steps(['villain_flop_bet']))).toBe('villain');
        expect(impliedAggressor('facing_check', steps(['villain_turn_all_in']))).toBe('villain');
        // A call names the OTHER player: whoever called was bet into.
        expect(impliedAggressor('facing_check', steps(['hero_flop_call']))).toBe('villain');
        expect(impliedAggressor('facing_check', steps(['villain_flop_call']))).toBe('hero');
        // Preflop steps and steps with no actor say nothing about it.
        expect(impliedAggressor('facing_check', steps(['villain_preflop_raise', 'flop_bet', 'hero_turn_bet']))).toBe('hero');
    });

    it('falls back to what the hero is facing', () => {
        expect(impliedAggressor('facing_bet', [])).toBe('villain');
        expect(impliedAggressor('facing_raise', [])).toBe('villain');
        // A donk lead is INTO the raiser, so the hero holds it; so does the
        // player everyone checks to.
        expect(impliedAggressor('facing_donk', [])).toBe('hero');
        expect(impliedAggressor('facing_check', [])).toBe('hero');
        expect(impliedAggressor('first_to_act', [])).toBe('hero');
        expect(impliedAggressor(undefined, [])).toBe('hero');
    });
});

describe('the hero preflop action', () => {
    it('has none to name before the flop', () => {
        expect(heroPreflopAction(spot({ street: 'preflop' }))).toBe('none');
    });

    it('takes the hero\'s own preflop step where the line has one', () => {
        expect(heroPreflopAction(spot({ nodePath: ['hero_preflop_3bet'] }))).toBe('3bet');
        expect(heroPreflopAction(spot({ nodePath: ['hero_preflop_raise'] }))).toBe('raise');
        expect(heroPreflopAction(spot({ nodePath: ['hero_preflop_limp'] }))).toBe('limp');
        expect(heroPreflopAction(spot({ nodePath: ['hero_preflop_call'] }))).toBe('call');
    });

    it('reads the hero off the opponent\'s step, in the pot the two of them built', () => {
        // They 3-bet, so the hero opened.
        expect(heroPreflopAction(spot({ nodePath: ['villain_preflop_3bet'] }))).toBe('raise');
        // They raised: in a single-raised pot the hero called, in a re-raised
        // one the hero is the re-raiser.
        expect(heroPreflopAction(spot({ nodePath: ['villain_preflop_raise'] }))).toBe('call');
        expect(heroPreflopAction(spot({ nodePath: ['villain_preflop_raise'], potType: 'three_bet' }))).toBe('3bet');
        // They limped: everyone limped, unless somebody raised after.
        expect(heroPreflopAction(spot({ nodePath: ['villain_preflop_limp'], potType: 'limped' }))).toBe('limp');
        expect(heroPreflopAction(spot({ nodePath: ['villain_preflop_limp'] }))).toBe('raise');
    });

    it('falls back to the pot type and the implied aggressor', () => {
        expect(heroPreflopAction(spot({ potType: 'limped' }))).toBe('limp');
        // Checked to the hero: the hero is the one with the initiative.
        expect(heroPreflopAction(spot())).toBe('raise');
        expect(heroPreflopAction(spot({ postflopFacingState: 'facing_bet' }))).toBe('call');
        expect(heroPreflopAction(spot({ potType: 'three_bet' }))).toBe('3bet');
        expect(heroPreflopAction(spot({ potType: 'four_bet_plus', postflopFacingState: 'facing_bet' }))).toBe('raise');
        // A postflop spot with no pot type at all names nothing.
        expect(heroPreflopAction(spot({ potType: undefined }))).toBe('none');
    });

    it('reads the hero action a pinned line states, through later streets', () => {
        // Barrel, call-down and check-raise lines: each path must read as the
        // preflop action the line gives the hero, because the hole cards are
        // dealt from it.
        expect(heroPreflopAction(spot({ nodePath: ['hero_preflop_raise', 'hero_flop_bet', 'villain_flop_call'] }))).toBe('raise');
        expect(heroPreflopAction(spot({
            nodePath: ['villain_preflop_raise', 'hero_preflop_call', 'villain_flop_bet', 'hero_flop_call'],
        }))).toBe('call');
        expect(heroPreflopAction(spot({
            nodePath: ['hero_preflop_raise', 'villain_preflop_call', 'hero_flop_check', 'villain_flop_bet', 'hero_flop_call'],
            street: 'river',
        }))).toBe('raise');
    });
});
