import { describe, it, expect } from 'vitest';
import type { Scenario } from '../generator/types.ts';
import { handHistory } from '../handHistory.ts';
import { cardOrThrow as card } from '../cards/cards.ts';
import { scenario, story } from './fixtures.ts';

/**
 * How a postflop spot's preflop pot got built: who raised, who limped, who
 * folded at their turn, in an order the table allows.
 */

describe('the preflop story of a postflop spot', () => {
    it('tells who raised preflop when the path says, and names every other player in the pot', () => {
        const opening = (nodePath: string[], villainPositions: Scenario['villainPositions'], potType: Scenario['potType'], playerCount: Scenario['playerCount'] = 'multiway') =>
            story(handHistory(scenario({ nodePath, villainPositions, potType, playerCount })).rows.filter((row) => row.street === 'preflop'));
        // A player in the pot BEFORE the raiser limped in first, and calls
        // when the raise comes back around; a blind out of the hand folds at
        // exactly their turn — no raise happens out of order.
        expect(opening(['hero_preflop_raise'], ['BB', 'LJ', 'BTN'], 'single_raised')).toEqual([
            'preflop:field@LJ limps 1', 'preflop:hero@CO raises to 3', 'preflop:field@BTN calls 3',
            'preflop:field@SB folds', 'preflop:villain@BB calls 3', 'preflop:field@LJ calls 3',
        ]);
        expect(opening(['villain_preflop_raise'], ['BB', 'UTG'], 'single_raised', 'three_way')).toEqual([
            'preflop:field@UTG limps 1', 'preflop:hero@CO limps 1', 'preflop:field@SB folds',
            'preflop:villain@BB raises to 3', 'preflop:field@UTG calls 3', 'preflop:hero@CO calls 3',
        ]);
        // A limped pot includes the hero's own limp, and the big blind checks
        // the option rather than "limping" money already posted.
        expect(opening([], ['BB', 'SB'], 'limped', 'three_way')).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@SB limps 1', 'preflop:villain@BB checks',
        ]);
        // `hero_preflop_3bet` means the VILLAIN opened and the hero re-raised
        // — this was once told backwards, as the hero raising right after
        // posting. A 3-bettor in front of the opener limp-reraised.
        // A lone raise step in a 3-bet pot names the OPENER; the other
        // player is the 3-bettor.
        expect(opening(['hero_preflop_raise'], ['BB'], 'three_bet', 'heads_up')).toEqual([
            'preflop:hero@CO raises to 3', 'preflop:field@SB folds',
            'preflop:villain@BB 3-bets to 9', 'preflop:hero@CO calls 9',
        ]);
        expect(opening(['hero_preflop_3bet'], ['BB'], 'three_bet', 'heads_up')).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@SB folds', 'preflop:villain@BB raises to 3',
            'preflop:hero@CO 3-bets to 9', 'preflop:villain@BB calls 9',
        ]);
        expect(opening([], ['BB'], 'three_bet', 'heads_up')).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@SB folds', 'preflop:villain@BB raises to 3',
            'preflop:hero@CO 3-bets to 9', 'preflop:villain@BB calls 9',
        ]);
        expect(opening([], ['BB', 'BTN'], 'four_bet_plus', 'three_way')).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@BTN limps 1', 'preflop:field@SB folds',
            'preflop:villain@BB raises to 3', 'preflop:hero@CO 3-bets to 9', 'preflop:villain@BB 4-bets to 22',
            'preflop:hero@CO calls 22', 'preflop:field@BTN calls 22',
        ]);
        expect(opening([], ['BB'], undefined, 'heads_up')).toEqual([]);
    });

    it('reads a villain open plus hero 3-bet off a plain raise step, and hands a stepless bet-facing pot to the villain', () => {
        // `villain_preflop_raise` in a 3-bet pot: the villain opened, so the
        // HERO is the 3-bettor; the blinds fold facing the 3-bet.
        const raised = handHistory(scenario({
            potType: 'three_bet', villainPosition: 'UTG1', villainPositions: ['UTG1'],
            nodePath: ['villain_preflop_raise'], postflopFacingState: 'facing_check',
        }));
        expect(story(raised.rows).slice(0, 5)).toEqual([
            'preflop:villain@UTG1 raises to 3', 'preflop:hero@CO 3-bets to 9',
            'preflop:field@SB folds', 'preflop:field@BB folds', 'preflop:villain@UTG1 calls 9',
        ]);
        // No steps at all and a bet arriving at the hero: the bettor has the
        // initiative, so the villain raised preflop.
        const bet = handHistory(scenario({ nodePath: [], postflopFacingState: 'facing_bet', villainRaiseSize: 'standard' }));
        expect(story(bet.rows).slice(0, 3)).toEqual(['preflop:hero@CO limps 1', 'preflop:field@SB folds', 'preflop:villain@BB raises to 3']);
    });

    it('tells a 3-bet from the blind in the order the table allows — the opener opened first', () => {
        // Hero in the small blind 3-bet a cutoff open: CO raises, SB 3-bets,
        // CO calls — never "the small blind raises right after posting".
        const { rows } = handHistory(scenario({
            heroPosition: 'SB', villainPosition: 'CO', villainPositions: ['CO'], potType: 'three_bet',
            nodePath: ['hero_preflop_3bet', 'hero_flop_check'], street: 'flop',
            board: ['Qc', 'Jc', '8c'].map(card), postflopFacingState: 'first_to_act',
        }));
        expect(story(rows).slice(0, 4)).toEqual([
            'preflop:villain@CO raises to 3', 'preflop:hero@SB 3-bets to 9',
            'preflop:field@BB folds', 'preflop:villain@CO calls 9',
        ]);
    });

    it('never attributes a raise to nobody — a blind defence with no preflop step reads initiative off the flop', () => {
        // Hero in the small blind, betting every street: the hero raised
        // preflop (the cutoff limp-called), and the big blind folds on the
        // record rather than vanishing with a blind in the pot.
        const { rows } = handHistory(scenario({
            heroPosition: 'SB', villainPosition: 'CO', villainPositions: ['CO'],
            nodePath: ['hero_flop_bet', 'villain_flop_call'],
        }));
        expect(rows.some((row) => row.actor === 'unknown')).toBe(false);
        expect(story(rows).slice(0, 4)).toEqual([
            'preflop:villain@CO limps 1', 'preflop:hero@SB raises to 3',
            'preflop:field@BB folds', 'preflop:villain@CO calls 3',
        ]);
    });

    it('caps an all-in at the last bet where no stack is stated, and reads the opponent as preflop raiser off a 3-bet step', () => {
        const { rows } = handHistory(scenario({
            nodePath: ['villain_preflop_3bet', 'villain_turn_all_in'], effectiveStackBb: undefined, postflopFacingState: 'facing_check',
        }));
        // The villain's 3-bet step marks the initiative as theirs; with the
        // pot called single-raised, the villain is the raiser and the hero
        // (in front of them) limped in.
        expect(story(rows).slice(0, 4)).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@SB folds',
            'preflop:villain@BB raises to 3', 'preflop:hero@CO calls 3',
        ]);
        expect(rows.find((row) => row.action === 'moves all in')?.amountBb).toBe(0);
    });

    it('copes with degenerate hand-built spots: a bet from nobody named, a villain 3-bet step, a 3-bet pot with no counterpart', () => {
        // Implied aggressor is the villain but no seat is named: the earliest
        // participant opens instead.
        const noSeat = handHistory(scenario({ villainPosition: undefined, villainPositions: [], nodePath: [], postflopFacingState: 'facing_bet' }));
        expect(story(noSeat.rows)[0]).toBe('preflop:hero@CO raises to 3');
        // An explicit villain 3-bet step names the villain as the re-raiser.
        const v3 = handHistory(scenario({ potType: 'three_bet', nodePath: ['villain_preflop_3bet'], postflopFacingState: 'facing_check' }));
        expect(story(v3.rows).slice(0, 4)).toEqual([
            'preflop:hero@CO raises to 3', 'preflop:field@SB folds',
            'preflop:villain@BB 3-bets to 9', 'preflop:hero@CO calls 9',
        ]);
        // A hero 3-bet with no NAMED villain leans on the other participant —
        // and survives having nobody at all.
        const alone = handHistory(scenario({ potType: 'three_bet', villainPosition: undefined, villainPositions: ['BB'], nodePath: ['hero_preflop_3bet'], postflopFacingState: 'facing_check' }));
        expect(story(alone.rows).slice(0, 3)).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@SB folds', 'preflop:field@BB raises to 3',
        ]);
        const solo = handHistory(scenario({ potType: 'three_bet', villainPosition: undefined, villainPositions: [], nodePath: ['hero_preflop_3bet'], postflopFacingState: 'facing_check' }));
        expect(story(solo.rows).length).toBeGreaterThan(0);
        // A raise-and-call with no raiser seat still lists the call and the fold.
        const rc = handHistory(scenario({
            street: 'preflop', board: [], postflopFacingState: undefined, preflopFacingState: 'facing_raise_and_call',
            villainRaiseSize: 'standard', nodePath: [], potBb: undefined,
            heroPosition: 'BB', villainPosition: undefined, villainPositions: ['UTG2'],
        }));
        expect(story(rc.rows)).toEqual(['preflop:villain raises to 3', 'preflop:field@UTG2 calls 3 ?', 'preflop:field@SB folds']);
        // An actorless step is skipped; the villain CALLING marks the hero as
        // the aggressor.
        const skip = handHistory(scenario({ nodePath: ['flop_check', 'villain_flop_call'], postflopFacingState: 'first_to_act' }));
        expect(story(skip.rows)[0]).toBe('preflop:hero@CO raises to 3');
    });
});
