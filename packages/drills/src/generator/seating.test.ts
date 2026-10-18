import { describe, it, expect } from 'vitest';
import { POSITIONS } from '../ontology/types.ts';
import { heroCheckedOn, legalVillainSeats, needsVillain, POSTFLOP_ORDER, PREFLOP_ORDER, STEAL_SEATS } from './seating.ts';

/**
 * Seating: who can have acted.
 *
 * The generator used to seat the named opponent anywhere, which produced
 * "facing a raise" from a seat that had not acted. These pin the table's own
 * order so that cannot come back.
 */

describe('the two orders', () => {
    it('preflop is seat order with the blinds last', () => {
        expect(PREFLOP_ORDER).toEqual(POSITIONS);
        expect(PREFLOP_ORDER.at(-1)).toBe('BB');
    });

    it('postflop the blinds act first and the button last', () => {
        expect(POSTFLOP_ORDER[0]).toBe('SB');
        expect(POSTFLOP_ORDER.at(-1)).toBe('BTN');
        expect([...POSTFLOP_ORDER].sort()).toEqual([...POSITIONS].sort());
    });
});

describe('preflop', () => {
    it('has nobody to face in an unopened pot', () => {
        expect(legalVillainSeats('BTN', 'preflop', { preflop: 'unopened' })).toEqual([]);
        expect(legalVillainSeats('BTN', 'preflop', {})).toEqual([]);
        expect(needsVillain('preflop', { preflop: 'unopened' })).toBe(false);
    });

    it('a raise, a limp or a raise-and-call came from a seat that acted earlier', () => {
        expect(legalVillainSeats('CO', 'preflop', { preflop: 'facing_raise' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
        expect(legalVillainSeats('BB', 'preflop', { preflop: 'facing_limp' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB']);
        // A late seat raising into the blinds is a steal, which the encoding
        // names separately — so a plain raise-and-call at the small blind came
        // from early or middle position.
        expect(legalVillainSeats('SB', 'preflop', { preflop: 'facing_raise_and_call' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
    });

    it('under the gun can face nobody, so a rule that says otherwise describes no table', () => {
        expect(legalVillainSeats('UTG', 'preflop', { preflop: 'facing_raise' })).toEqual([]);
        expect(needsVillain('preflop', { preflop: 'facing_raise' })).toBe(true);
    });

    it('a steal comes from late position into the blinds', () => {
        expect(legalVillainSeats('BB', 'preflop', { preflop: 'facing_steal' })).toEqual(['CO', 'BTN', 'SB']);
        expect(legalVillainSeats('SB', 'preflop', { preflop: 'facing_steal' })).toEqual(['CO', 'BTN']);
        expect(STEAL_SEATS).toEqual(['CO', 'BTN', 'SB']);
    });

    it('a three-bet answers the hero\'s own raise, so it comes from a seat still to act', () => {
        expect(legalVillainSeats('CO', 'preflop', { preflop: 'facing_3bet' })).toEqual(['BTN', 'SB', 'BB']);
        expect(legalVillainSeats('BB', 'preflop', { preflop: 'facing_3bet' })).toEqual([]);
    });

    it('a four-bet comes from the raiser the hero three-bet, who acted earlier', () => {
        expect(legalVillainSeats('BTN', 'preflop', { preflop: 'facing_4bet' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO']);
    });
});

describe('postflop', () => {
    it('a check, bet or lead into the hero came from ahead of the hero', () => {
        expect(legalVillainSeats('BTN', 'flop', { postflop: 'facing_bet' })).toEqual(POSTFLOP_ORDER.slice(0, -1));
        expect(legalVillainSeats('UTG', 'turn', { postflop: 'facing_check' })).toEqual(['SB', 'BB']);
        expect(legalVillainSeats('CO', 'river', { postflop: 'facing_donk' }))
            .toEqual(['SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
    });

    it('first to act means every opponent is still behind', () => {
        expect(legalVillainSeats('SB', 'flop', { postflop: 'first_to_act' })).toEqual(POSTFLOP_ORDER.slice(1));
        expect(legalVillainSeats('BTN', 'flop', { postflop: 'first_to_act' })).toEqual([]);
    });

    it('a raise can come from either side — a check-raise from ahead, a raise of the hero\'s bet from behind', () => {
        const seats = legalVillainSeats('HJ', 'turn', { postflop: 'facing_raise' });
        expect(seats).toHaveLength(POSITIONS.length - 1);
        expect(seats).not.toContain('HJ');
    });

    it('always needs somebody', () => {
        expect(needsVillain('flop', { postflop: 'first_to_act' })).toBe(true);
    });

    it('a bet the hero invited by checking first came from BEHIND the hero', () => {
        // The big blind checks, the limpers check, the button bets: a
        // check-raise spot seats the bettor after the hero, not ahead.
        expect(legalVillainSeats('BB', 'flop', { postflop: 'facing_bet', heroCheckedFirst: true }))
            .toEqual(POSTFLOP_ORDER.slice(2));
        expect(legalVillainSeats('BTN', 'flop', { postflop: 'facing_bet', heroCheckedFirst: true })).toEqual([]);
        // Without the check, the same facing state is a bet the hero faces cold.
        expect(legalVillainSeats('BB', 'flop', { postflop: 'facing_bet', heroCheckedFirst: false })).toEqual(['SB']);
    });
});

describe('reading the check off the path', () => {
    it('a same-street check while facing a bet belongs to the hero, prefixed or not', () => {
        expect(heroCheckedOn(['hero_preflop_raise', 'hero_flop_check', 'villain_flop_bet'], 'flop')).toBe(true);
        expect(heroCheckedOn(['preflop_raise', 'flop_check', 'flop_bet'], 'flop')).toBe(true);
    });

    it('a check on an earlier street, a check by the opponent, or no path at all is not', () => {
        expect(heroCheckedOn(['hero_flop_check', 'villain_flop_bet', 'hero_flop_call', 'villain_turn_bet'], 'turn')).toBe(false);
        expect(heroCheckedOn(['villain_flop_check', 'hero_flop_bet'], 'flop')).toBe(false);
        expect(heroCheckedOn(undefined, 'flop')).toBe(false);
    });
});

describe('a raise into the blinds that is not a steal', () => {
    it('comes from an early or middle seat — a late raise into the blinds is `facing_steal`', () => {
        expect(legalVillainSeats('BB', 'preflop', { preflop: 'facing_raise' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
        expect(legalVillainSeats('SB', 'preflop', { preflop: 'facing_raise_and_call' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
        // Anywhere else, every earlier seat can have raised.
        expect(legalVillainSeats('BTN', 'preflop', { preflop: 'facing_raise' }))
            .toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO']);
    });
});
