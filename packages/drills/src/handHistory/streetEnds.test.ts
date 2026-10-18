import { describe, it, expect } from 'vitest';
import { handHistory } from '../handHistory.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { line, scenario, story } from './fixtures.ts';

/**
 * Some rules end their `node_path` with the very action the hero is
 * answering, and the rest stop before it. The walk replays the
 * path and the facing state states the action, so under the first convention
 * both fired: one seat betting twice in a row, at two different prices,
 * measured in a tenth of every spot dealt.
 */
describe('the action being answered, when the line already told it', () => {
    it('states a bet once, at the bucket the source stated, rather than twice', () => {
        const spot = scenario({
            street: 'flop',
            board: ['Qc', 'Jc', '8c'].map(card),
            postflopFacingState: 'facing_bet',
            villainRaiseSize: 'small',
            potBb: 8,
            nodePath: ['hero_preflop_call', 'villain_flop_bet'],
        });
        expect(story(handHistory(spot).rows)).toEqual([
            'preflop:hero@CO limps 1',
            'preflop:field@SB folds',
            'preflop:villain@BB raises to 3',
            'preflop:hero@CO calls 3',
            // ONE flop row, priced by the bucket (40% of an 8bb pot) rather
            // than by the walk's three-quarters — and it is the pending one.
            'flop:villain@BB bets 3 ?',
        ]);
    });

    it('sizes a raise off the bet it answers, not off itself', () => {
        // `[hero_turn_bet, villain_turn_raise]` with `facing_raise`: the raise
        // is the pending action. The walk had already overwritten the running
        // bet with the raise, so a multiple of that raised the raise.
        const spot = scenario({
            postflopFacingState: 'facing_raise',
            villainRaiseSize: 'small',
            nodePath: ['hero_turn_bet', 'villain_turn_raise'],
        });
        const turn = handHistory(spot).rows.filter((row) => row.street === 'turn');
        expect(turn.map(line)).toEqual([
            'turn:villain@BB checks',
            'turn:hero@CO bets 6',
            'turn:villain@BB raises to 12 ?',
        ]);
    });

    it('states a check once', () => {
        const spot = scenario({
            postflopFacingState: 'facing_check',
            nodePath: ['villain_turn_check'],
        });
        const turn = handHistory(spot).rows.filter((row) => row.street === 'turn');
        expect(turn.map(line)).toEqual(['turn:villain@BB checks ?']);
    });

    it('leaves a line that stops before the pending action alone', () => {
        // The other convention: the villain's bet is not in the path, so the
        // facing state is the only thing that states it.
        const spot = scenario({
            street: 'flop',
            board: ['Qc', 'Jc', '8c'].map(card),
            postflopFacingState: 'facing_bet',
            villainRaiseSize: 'small',
            potBb: 8,
            nodePath: ['hero_preflop_call'],
        });
        const flop = handHistory(spot).rows.filter((row) => row.street === 'flop');
        expect(flop.map(line)).toEqual(['flop:villain@BB bets 3 ?']);
    });

    it('does not mistake a step of the HERO for the action being answered', () => {
        const spot = scenario({
            street: 'flop',
            board: ['Qc', 'Jc', '8c'].map(card),
            postflopFacingState: 'facing_raise',
            villainRaiseSize: 'small',
            potBb: 8,
            nodePath: ['hero_flop_bet'],
        });
        const flop = handHistory(spot).rows.filter((row) => row.street === 'flop');
        expect(flop.map(line)).toEqual([
            'flop:villain@BB checks',
            'flop:hero@CO bets 6',
            'flop:villain@BB raises to 12 ?',
        ]);
    });
});
