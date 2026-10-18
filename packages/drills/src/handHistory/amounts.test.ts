import { describe, it, expect } from 'vitest';
import type { Scenario } from '../generator/types.ts';
import { flopPotBb } from '../generator/potAndStack.ts';
import { handHistory } from '../handHistory.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { scenario, story } from './fixtures.ts';

/**
 * The amounts a postflop history prints: they follow the generator's own pot
 * model, so the pot the history builds is the pot the grader read, and the bet
 * in front of the hero is the source's bucket applied to that pot.
 */

describe('a postflop spot', () => {
    it('tells the hand in order — how the pot was built, each authored step with its amount, then the action being answered', () => {
        const { rows, bets, potBb } = handHistory(scenario());
        // The villain's flop check is implied by the hero's bet — a bet from
        // the seat that does not open the street was invited — and is told.
        expect(story(rows)).toEqual([
            'preflop:hero@CO raises to 3',
            'preflop:field@SB folds',
            'preflop:villain@BB calls 3',
            'flop:villain@BB checks',
            'flop:hero@CO bets 6',
            'flop:villain@BB calls 6',
            'turn:villain@BB checks ?',
        ]);
        // Nothing in front of anybody on the turn yet; the middle is the swept pot.
        expect(bets).toEqual({});
        expect(potBb).toBe(20);
    });

    it('grows the pot by the generator\'s own factor, so the flop bet and the turn pot agree with the grader', () => {
        // Single-raised heads-up flop pot is 8bb; a bet of three-quarters (6)
        // and a call make it 20 — which is what the generator calls the turn
        // pot, and what the turn bet is measured against. The bet being faced
        // sits in front of its seat, and the middle reads pot plus bets.
        const spot = scenario({ postflopFacingState: 'facing_bet', villainRaiseSize: 'large' });
        const { rows, bets, potBb } = handHistory(spot);
        expect(flopPotBb('single_raised', 'heads_up')).toBe(8);
        expect(rows.find((row) => row.street === 'flop' && row.action === 'bets')?.amountBb).toBe(6);
        expect(bets).toEqual({ BB: 17 }); // 0.85 × 20
        expect(potBb).toBe(37);
        expect(rows.at(-1)).toMatchObject({ street: 'turn', actor: 'villain', action: 'bets', amountBb: 17, pending: true });
    });

    it('sizes the bet in front of the hero by the source\'s bucket, and an all-in by the stack', () => {
        const bet = (size: Scenario['villainRaiseSize']) =>
            handHistory(scenario({ postflopFacingState: 'facing_bet', villainRaiseSize: size })).bets.BB;
        expect(bet('small')).toBe(8);
        expect(bet('standard')).toBe(12);
        expect(bet('large')).toBe(17);
        expect(bet('all_in')).toBe(100);
        expect(bet(undefined)).toBe(12);
        expect(handHistory(scenario({ postflopFacingState: 'facing_bet', villainRaiseSize: 'all_in', effectiveStackBb: undefined })).bets.BB).toBe(20);
    });

    it('puts the hero\'s own bet on this street in front of the hero too', () => {
        // A raise of the hero's turn bet: both bets sit on the table.
        const { bets, potBb } = handHistory(scenario({
            nodePath: ['hero_preflop_raise', 'hero_flop_bet', 'villain_flop_call', 'hero_turn_bet'],
            postflopFacingState: 'facing_raise', villainRaiseSize: 'large',
        }));
        // The raise is a MULTIPLE of the bet it raises — 3.5× for the large
        // bucket — never a fraction of the pot smaller than the bet itself.
        expect(bets).toEqual({ CO: 15, BB: 53 });
        expect(potBb).toBe(88);
    });

    it('names a lead, a raise and a check for what they are, and says nothing for first to act', () => {
        const last = (state: Scenario['postflopFacingState']) => {
            const { rows } = handHistory(scenario({ postflopFacingState: state, villainRaiseSize: 'standard' }));
            return rows.at(-1);
        };
        expect(last('facing_donk')?.action).toBe('leads');
        // An all-in raise is the stack — or the pot, where no stack is stated.
        // A bet that reaches the stack is CALLED all in: "raises to 100" with
        // 100 behind is the same chips said less clearly, and the reader is
        // being asked whether to play for stacks.
        const shove = handHistory(scenario({ postflopFacingState: 'facing_raise', villainRaiseSize: 'all_in' }));
        expect(shove.rows.at(-1)).toMatchObject({ action: 'moves all in', amountBb: 100, pending: true });
        const potShove = handHistory(scenario({ postflopFacingState: 'facing_raise', villainRaiseSize: 'all_in', effectiveStackBb: undefined }));
        expect(potShove.rows.at(-1)).toMatchObject({ action: 'raises to', amountBb: 20, pending: true });
        // No stated size raises the ordinary multiple.
        const plain = handHistory(scenario({ postflopFacingState: 'facing_raise', villainRaiseSize: undefined }));
        expect(plain.rows.at(-1)).toMatchObject({ action: 'raises to', amountBb: 41, pending: true });
        expect(last('facing_raise')?.action).toBe('raises to');
        expect(last('facing_check')?.action).toBe('checks');
        expect(last('first_to_act')?.street).toBe('flop');
        expect(last(undefined)?.street).toBe('flop');
        expect(last(undefined)?.pending).toBeUndefined();
    });

    it('reads a raise, a check, an all-in, a fold and an unknown step off the path', () => {
        const { rows, potBb } = handHistory(scenario({
            street: 'river',
            board: ['Qc', 'Jc', '8c', '2d', '3s'].map(card),
            nodePath: ['villain_flop_check', 'hero_flop_bet', 'villain_flop_raise', 'hero_flop_call', 'villain_turn_all_in', 'hero_turn_call', 'villain_river_fold', 'river_shove'],
            postflopFacingState: 'first_to_act',
            potBb: undefined,
        }));
        // No preflop step, but the hero held the flop initiative — so the
        // hero raised preflop; nobody is "someone", and the folded small
        // blind folds at their turn.
        expect(story(rows)).toEqual([
            'preflop:hero@CO raises to 3',
            'preflop:field@SB folds',
            'preflop:villain@BB calls 3',
            'flop:villain@BB checks',
            'flop:hero@CO bets 6',
            'flop:villain@BB raises to 18',
            'flop:hero@CO calls 18',
            'turn:villain@BB moves all in 100',
            'turn:hero@CO calls 100',
            'river:villain@BB folds',
            'river:unknown shove',
        ]);
        // No generator pot on a hand-built spot: nothing is claimed for the middle.
        expect(potBb).toBeUndefined();
    });

    it('raises from scratch when the path raises before any bet', () => {
        const { rows } = handHistory(scenario({ nodePath: ['villain_flop_raise'], potBb: undefined }));
        expect(rows.find((row) => row.action === 'raises to' && row.street === 'flop')?.amountBb).toBe(18);
    });
});
