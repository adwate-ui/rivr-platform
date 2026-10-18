import { describe, it, expect } from 'vitest';
import type { SprBracket } from '../ontology/types.ts';
import type { Scenario } from './types.ts';
import { generated, postflopRule } from './fixtures.ts';

/**
 * The money behind a generated spot: stacks, pots and the stack-to-pot bracket
 * they make, and how often each kind of pot is dealt.
 */

const DEPTH: Readonly<Record<SprBracket, number>> = { very_low: 0, low: 1, medium: 2, high: 3 };
/** How much is behind, as an order: a lower number is shallower. */
const depth = (spot: Scenario): number => (spot.sprBracket === undefined ? -1 : DEPTH[spot.sprBracket]);

describe('stacks and pots', () => {
    it('derives stack-to-pot from the stack and the pot, and fits the stack when a rule demands a bracket', () => {
        // A short stack in a three-bet pot is never "a lot behind".
        for (let seed = 0; seed < 30; seed += 1) {
            const shallow = generated(postflopRule({ stack_bracket: ['short'], pot_type: ['three_bet'] }), seed);
            expect(['very_low', 'low']).toContain(shallow.sprBracket);
        }
        // A rule that wants a deep-stack flop at a LOW ratio gets a stack that
        // lands there where the bracket allows; where it cannot, it keeps its
        // stack and the bracket it asked for, and the validator is the one to
        // call that incoherent.
        for (let seed = 0; seed < 30; seed += 1) {
            const demanded = generated(postflopRule({
                stack_bracket: ['standard'], pot_type: ['limped'], spr_bracket: ['very_low'],
            }), seed);
            expect(demanded.sprBracket).toBe('very_low');
        }
        const stuck = generated(postflopRule({
            stack_bracket: ['very_deep'], pot_type: ['limped'], spr_bracket: ['very_low'],
        }), 3);
        expect(stuck.sprBracket).toBe('very_low');
        expect(stuck.stackBracket).toBe('very_deep');
        // And the other way round: a short stack cannot be fitted to a HIGH
        // ratio in a big pot without leaving its bracket, so it keeps both.
        const tall = generated(postflopRule({
            street: 'river', stack_bracket: ['short'], pot_type: ['three_bet'], player_count: ['multiway'], spr_bracket: ['high'],
        }), 3);
        expect(tall.sprBracket).toBe('high');
        expect(tall.stackBracket).toBe('short');
        expect(tall.effectiveStackBb).toBeLessThanOrEqual(60);
        // And where the stack bracket CAN hold the demanded ratio, the stack is
        // moved inside it rather than left to contradict the bracket.
        // A standard stack (61-199bb) in a three-bet multiway pot of ~48bb:
        // a low ratio wants ~145bb, which the bracket holds, so the stack is
        // set there whenever the natural deal did not already land low.
        let refitted = 0;
        for (let seed = 0; seed < 30; seed += 1) {
            const fitted = generated(postflopRule({
                stack_bracket: ['standard'], pot_type: ['three_bet'], player_count: ['multiway'], spr_bracket: ['low'],
            }), seed);
            expect(fitted.sprBracket).toBe('low');
            expect(fitted.effectiveStackBb).toBeGreaterThanOrEqual(61);
            expect(fitted.effectiveStackBb).toBeLessThanOrEqual(199);
            if (fitted.effectiveStackBb === 145) refitted += 1;
        }
        expect(refitted).toBeGreaterThan(0);
    });

    it('counts the streets that were bet when sizing the pot behind a turn or river decision', () => {
        // The same stack is shallower against a pot that grew on the flop: a
        // turn after "you bet, they called" has less behind than a turn that
        // checked through. Measured as the bracket, which is what a rule reads.
        let shallowerOrEqual = 0, compared = 0;
        for (let seed = 0; seed < 40; seed += 1) {
            const quiet = generated(postflopRule({
                street: 'turn', stack_bracket: ['standard'], pot_type: ['single_raised'], player_count: ['heads_up'],
            }), seed);
            const grown = generated({
                ...postflopRule({
                    street: 'turn', stack_bracket: ['standard'], pot_type: ['single_raised'], player_count: ['heads_up'],
                }),
                situation: {
                    street: 'turn', stack_bracket: ['standard'], pot_type: ['single_raised'], player_count: ['heads_up'],
                    node_path: ['hero_flop_bet', 'villain_flop_call'],
                },
            }, seed);
            compared += 1;
            if (depth(grown) <= depth(quiet)) shallowerOrEqual += 1;
        }
        expect(shallowerOrEqual).toBe(compared);
    });

    it('deals postflop pot types as they arise, not one in four each', () => {
        // Sampled evenly, a quarter of every pot-type-free rule's spots were
        // FOUR-BET pots, though four-bet pots are rare in the games the drills
        // describe and almost never seen after the flop.
        const counts = new Map<string, number>();
        for (let seed = 0; seed < 400; seed += 1) {
            const type = generated(postflopRule({}), seed).potType ?? 'none';
            counts.set(type, (counts.get(type) ?? 0) + 1);
        }
        const share = (type: string): number => (counts.get(type) ?? 0) / 400;
        expect(share('single_raised')).toBeGreaterThan(share('limped'));
        expect(share('limped')).toBeGreaterThan(share('three_bet'));
        expect(share('three_bet')).toBeGreaterThan(share('four_bet_plus'));
        expect(share('four_bet_plus')).toBeLessThan(0.12);
        // A rule that names its pot types gets them as it named them.
        for (let seed = 0; seed < 20; seed += 1) {
            expect(generated(postflopRule({ pot_type: ['three_bet'] }), seed).potType).toBe('three_bet');
        }
    });

    it('moves the stack bracket with a stack fitted to a demanded ratio', () => {
        // A rule that asks for a ratio and never for a stack gets a stack the
        // ratio needs — and the BRACKET has to follow it, or the spot says
        // "the pot is large next to what is behind" over 300 blinds behind.
        for (let seed = 0; seed < 30; seed += 1) {
            const spot = generated(postflopRule({ pot_type: ['limped'], spr_bracket: ['very_low'] }), seed);
            expect(spot.sprBracket).toBe('very_low');
            expect(spot.stackBracket).toBe('short');
            expect(spot.effectiveStackBb).toBeLessThanOrEqual(60);
        }
        // The bracket the fitted stack lands in, whichever one that is. In a
        // three-bet multiway pot of about fifty blinds, each ratio names a
        // different depth — which is the point: the two agree on screen.
        const brackets = { low: new Set<string>(), medium: new Set<string>(), high: new Set<string>() };
        for (const spr of ['low', 'medium', 'high'] as const) {
            for (let seed = 0; seed < 20; seed += 1) {
                const spot = generated(postflopRule({
                    street: 'river', pot_type: ['three_bet'], player_count: ['multiway'], spr_bracket: [spr],
                }), seed);
                expect(spot.sprBracket).toBe(spr);
                brackets[spr].add(spot.stackBracket);
            }
        }
        expect([...brackets.low]).toEqual(['standard']);
        expect([...brackets.medium].every((b) => b === 'deep' || b === 'very_deep')).toBe(true);
        expect([...brackets.high]).toEqual(['very_deep']);
    });
});
