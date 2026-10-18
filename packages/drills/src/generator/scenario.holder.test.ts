import { describe, it, expect } from 'vitest';
import type { ClassifyRule } from '../ontology/types.ts';
import { parseHands } from '../range/parse.ts';
import { legalVillainSeats, pathImpliedVillainSide } from './seating.ts';
import { generateScenario } from './scenario.ts';
import { generated, postflopRule } from './fixtures.ts';

/**
 * What a line says about the seats, and whose cards are on the table.
 */

describe('a river exclusion reads the turn card too', () => {
    it('never deals a river spot whose TURN completed what the rule excludes, and carries the turn tags', () => {
        // A rule that bets the river when the draws missed once fired into a
        // four-flush, because the flush had come on the turn and only the river
        // card was judged. The generator now refuses the board, and the scenario
        // carries the turn's tags for the matcher to read the same way.
        const rule = postflopRule({
            street: 'river',
            runout_exclude: ['flush_completing', 'straight_completing'],
            hand_class_any: ['no_pair', 'ace_high'],
        });
        let seen = 0;
        for (let seed = 0; seed < 150; seed += 1) {
            const result = generateScenario(rule, { seed });
            if (!result.ok) continue;
            seen += 1;
            const spot = result.scenario;
            expect(spot.priorRunouts).toBeDefined();
            expect(spot.priorRunouts).not.toContain('flush_completing');
            expect(spot.priorRunouts).not.toContain('straight_completing');
            expect(spot.runouts).not.toContain('flush_completing');
            expect(spot.runouts).not.toContain('straight_completing');
        }
        expect(seen).toBeGreaterThan(50);
    });
});

describe('what an action line says about the seats', () => {
    it('reads the villain side off a check answered on the same street', () => {
        expect(pathImpliedVillainSide(['hero_flop_check', 'villain_flop_bet'])).toBe('after_hero');
        expect(pathImpliedVillainSide(['villain_flop_check', 'hero_flop_bet'])).toBe('before_hero');
        // An unanswered check, a bet-first street and a preflop step say nothing.
        expect(pathImpliedVillainSide(['hero_river_check'])).toBeUndefined();
        expect(pathImpliedVillainSide(['villain_flop_bet', 'hero_flop_call'])).toBeUndefined();
        expect(pathImpliedVillainSide(['hero_preflop_raise'])).toBeUndefined();
        expect(pathImpliedVillainSide(undefined)).toBeUndefined();
    });

    it('calls two streets that disagree a conflict, and a conflict seats nobody', () => {
        const conflicted = ['hero_flop_check', 'villain_flop_bet', 'villain_turn_check', 'hero_turn_bet'];
        expect(pathImpliedVillainSide(conflicted)).toBe('conflict');
        expect(legalVillainSeats('CO', 'turn', { postflop: 'facing_raise', villainSide: 'conflict' })).toEqual([]);
    });

    it('filters the pending state seats by the side the line fixed', () => {
        // A raise can come from either side — unless the flop already said.
        expect(legalVillainSeats('CO', 'turn', { postflop: 'facing_raise', villainSide: 'after_hero' })).toEqual(['BTN']);
        expect(legalVillainSeats('BB', 'turn', { postflop: 'facing_raise', villainSide: 'before_hero' })).toEqual(['SB']);
        // "Checked to you" from a line whose villain sits BEHIND the hero is
        // the contradiction a reader once met as "probe out of position" while
        // sitting in position: no seat can play it.
        expect(legalVillainSeats('BB', 'turn', { postflop: 'facing_check', villainSide: 'after_hero' })).toEqual([]);
    });
});

describe('whose cards are on the table', () => {
    /*
     * A classify rule may ask about the OPPONENT's holding — "would he have
     * called the flop with this?" — and then the two cards drawn are not the
     * hero's. Two things follow, and both are easy to get wrong in a way that
     * produces a plausible-looking spot:
     *
     *  - the drawing has to say so, or a reader assumes the cards are theirs;
     *  - nothing about the hand should be filtered through what the HERO could
     *    have played, because the hero did not play it.
     */
    const fitRule = (perspective: 'hero' | 'villain'): ClassifyRule => ({
        kind: 'classify',
        situation: { street: ['flop'] },
        labels: [
            { id: 'strong_fit', label: 'Strong fit' },
            { id: 'weak_fit', label: 'Weak fit' },
        ],
        perspective,
        prompt: 'Strong fit or weak fit?',
        branches: [],
        default: { label: 'weak_fit' },
    });

    it('marks the hand as belonging to the villain when the question is about their holding', () => {
        for (let seed = 0; seed < 20; seed += 1) {
            expect(generated(fitRule('villain'), seed).holder).toBe('villain');
        }
    });

    it('marks it as the hero otherwise, including for a hero-perspective classify rule', () => {
        expect(generated(fitRule('hero'), 1).holder).toBe('hero');
        expect(generated(postflopRule({}), 1).holder).toBe('hero');
    });

    it('does not filter the villain hand through what the hero could have raised', () => {
        // `playable` answers "could the hero have opened this from here". Asked
        // about somebody else's cards it is the wrong question, and asking it
        // would reject exactly the holdings a fit question is about.
        let asked = 0;
        const playable = () => {
            asked += 1;
            return parseHands(['AA']);
        };
        generated(fitRule('villain'), 3, undefined, { playable });
        expect(asked).toBe(0);

        generated(fitRule('hero'), 3, undefined, { playable });
        expect(asked).toBeGreaterThan(0);
    });
});
