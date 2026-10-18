import { describe, it, expect } from 'vitest';
import { handHistory } from '../handHistory.ts';
import { line, scenario, story } from './fixtures.ts';

/**
 * The postflop streets walked from the line: the bet a call answers, the checks
 * the line leaves out, and the stack that caps what is bet.
 */

describe('walking the streets', () => {
    it('shows the bet a call answers, and puts a step nobody is named for in front of nobody', () => {
        // A call answers a bet. Where the line names the caller and not the
        // bet — `[hero_turn_call]` was two rules' whole flop — the history
        // used to render "calls · checks", a street nobody has ever played,
        // and the tellability gate did not look for it. The bet is the other
        // player's, and it is shown.
        const { rows, bets, potBb } = handHistory(scenario({
            nodePath: ['hero_flop_call', 'turn_bet'], postflopFacingState: 'first_to_act',
        }));
        // The hero CALLED the flop, so the initiative was the opponent's:
        // the big blind raised and the cutoff, already in, called.
        expect(story(rows).slice(0, 3)).toEqual([
            'preflop:hero@CO limps 1', 'preflop:field@SB folds', 'preflop:villain@BB raises to 3',
        ]);
        expect(rows.filter((row) => row.street === 'flop').map(line)).toEqual([
            'flop:villain@BB bets 6', 'flop:hero@CO calls 6',
        ]);
        // A bet on the current street with no actor cannot be put in front of
        // a seat, so the middle reads only the swept pot.
        expect(rows.find((row) => row.street === 'turn')).toMatchObject({ actor: 'unknown', action: 'bets', amountBb: 15 });
        expect(bets).toEqual({});
        expect(potBb).toBe(20);
    });

    it('shows the bet whichever side the call came from, and stays silent when the line names neither', () => {
        const flop = (path: readonly string[]): string[] => handHistory(scenario({
            nodePath: path, postflopFacingState: 'facing_check',
        })).rows.filter((row) => row.street === 'flop').map(line);
        // Whoever called, the other player bet — and the check that invited
        // the bet is woven in ahead of it, so the street opens with the
        // earliest live seat.
        expect(flop(['hero_preflop_raise', 'villain_flop_call'])).toEqual([
            'flop:villain@BB checks', 'flop:hero@CO bets 6', 'flop:villain@BB calls 6',
        ]);
        // A step that names nobody cannot name a bettor either, so the call
        // stands alone and carries no amount — the 1.6 vocabulary, unchanged.
        expect(flop(['hero_preflop_raise', 'flop_call'])).toEqual(['flop:unknown calls']);
    });

    it('finishes a checked-round earlier street with the checks the line leaves out', () => {
        // The line names one check on the flop; the other player checked too,
        // or the street would not have reached the turn.
        const { rows } = handHistory(scenario({
            nodePath: ['hero_preflop_raise', 'villain_flop_check'], postflopFacingState: 'facing_check',
        }));
        expect(rows.filter((row) => row.street === 'flop').map(line)).toEqual([
            'flop:villain@BB checks', 'flop:hero@CO checks',
        ]);
    });

    it('never bets more than is behind, and calls it all in when it is the stack', () => {
        // 130 of 6,300 generated spots once showed a bet larger than the
        // stack — "bets 38" with 25 behind — because nothing capped a bucket
        // at what the player had. At a very low ratio the large bet IS the
        // stack: a stack-committing bet, which is what the spot always was.
        const shallow = handHistory(scenario({
            effectiveStackBb: 12, potBb: 40, postflopFacingState: 'facing_bet', villainRaiseSize: 'large',
        }));
        const pending = shallow.rows.at(-1);
        expect(pending).toMatchObject({ action: 'moves all in', amountBb: 12 });
        expect(shallow.rows.every((row) => (row.amountBb ?? 0) <= 12)).toBe(true);
    });

    it('caps only the street being answered, because an earlier bet came out of a bigger stack', () => {
        // What is behind is what is behind NOW. The sweep dealt a four-bet
        // pot at a 20-blind stack and the flop bet was capped at 20 and told
        // as "moves all in 20" — and then the turn was played. That flop bet
        // went in when the hero had 20 more than they do now; the pot model
        // grew by the full bet, and so does the story.
        const spot = scenario({
            potType: 'four_bet_plus', effectiveStackBb: 20, potBb: 125, heroPosition: 'UTG2',
            villainPosition: 'UTG1', villainPositions: ['UTG1'],
        });
        const { rows } = handHistory(spot);
        const flop = rows.filter((row) => row.street === 'flop');
        expect(flop.map(line)).toEqual([
            'flop:villain@UTG1 checks',
            'flop:hero@UTG2 bets 38',
            'flop:villain@UTG1 calls 38',
        ]);
        // Nobody went all in before the action being answered.
        expect(rows.some((row) => row.street !== 'turn' && row.action === 'moves all in')).toBe(false);

        // The same line with a raise and an implied bet on the flop, where
        // the earlier rows are the only thing the cap could have touched.
        const raised = handHistory(scenario({
            potType: 'four_bet_plus', effectiveStackBb: 20, potBb: 125,
            nodePath: ['hero_preflop_raise', 'villain_flop_call', 'hero_flop_raise', 'villain_flop_call'],
        }));
        const flopRaised = raised.rows.filter((row) => row.street === 'flop');
        expect(flopRaised.every((row) => row.action !== 'moves all in')).toBe(true);
        expect(Math.max(...flopRaised.map((row) => row.amountBb ?? 0))).toBeGreaterThan(20);
    });

    it('copes with a spot that names no opponent seat', () => {
        const { rows } = handHistory(scenario({ villainPosition: undefined, villainPositions: [], nodePath: [] }));
        expect(story(rows)).toEqual([
            'preflop:hero@CO raises to 3', 'preflop:field@SB folds', 'preflop:field@BB folds',
            'flop:hero@CO checks', 'turn:villain checks ?',
        ]);
    });
});
