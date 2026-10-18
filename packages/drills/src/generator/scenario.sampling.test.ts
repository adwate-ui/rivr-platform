import { describe, it, expect } from 'vitest';
import type { PredicateRule } from '../ontology/types.ts';
import { parseHands } from '../range/parse.ts';
import { generateScenario } from './scenario.ts';
import { generated, postflopRule, preflopRule } from './fixtures.ts';

/**
 * The generator: sampling what a rule constrains, and varying what it omits.
 */

describe('sampling', () => {
    it('honours a constrained coordinate every time', () => {
        for (let seed = 0; seed < 40; seed += 1) {
            const scenario = generated(postflopRule({ hero_position: ['BTN'] }), seed);
            expect(scenario.heroPosition).toBe('BTN');
        }
    });

    it('varies an omitted coordinate, which is where unauthored leaks come from', () => {
        const seen = new Set<string>();
        for (let seed = 0; seed < 60; seed += 1) {
            seen.add(generated(postflopRule({}), seed).stackBracket);
        }
        // Nothing in the rule mentions stack depth, and the drill still asks
        // about all of them — which is what makes a cross-tab by stack possible.
        expect(seen.size).toBeGreaterThan(1);
    });

    it('is reproducible from its seed', () => {
        const a = generated(postflopRule({}), 4242);
        const b = generated(postflopRule({}), 4242);
        expect(b).toEqual(a);
    });

    it('gives different seeds different spots', () => {
        const a = generated(postflopRule({}), 1);
        const b = generated(postflopRule({}), 2);
        expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    });

    it('never seats the villain where the hero is sitting', () => {
        for (let seed = 0; seed < 50; seed += 1) {
            const scenario = generated(postflopRule({}), seed);
            expect(scenario.villainPosition).not.toBe(scenario.heroPosition);
        }
    });

    it('picks a villain type only from the ones the rule named', () => {
        const scenario = generated(postflopRule({ villain_types: ['opp_station'] }), 3);
        expect(scenario.villainType).toBe('opp_station');
        expect(generated(postflopRule({}), 3).villainType).toBeUndefined();
    });

    it('deals the right number of board cards for the street', () => {
        expect(generated(preflopRule(), 1).board).toHaveLength(0);
        expect(generated(postflopRule({ street: 'flop' }), 1).board).toHaveLength(3);
        expect(generated(postflopRule({ street: 'turn' }), 1).board).toHaveLength(4);
        expect(generated(postflopRule({ street: 'river' }), 1).board).toHaveLength(5);
    });

    it('classifies the hand it dealt, postflop only', () => {
        const flop = generated(postflopRule({}), 9);
        expect(flop.handClass).toBeDefined();
        expect(flop.relativeStrength).toBeDefined();
        expect(flop.boardTags.length).toBeGreaterThan(0);

        const preflop = generated(preflopRule(), 9, parseHands(['AA']));
        expect(preflop.handClass).toBeUndefined();
        expect(preflop.boardTags).toEqual([]);
    });

    it('asks for a facing state appropriate to the street', () => {
        expect(generated(preflopRule(), 5).preflopFacingState).toBeDefined();
        expect(generated(preflopRule(), 5).postflopFacingState).toBeUndefined();
        expect(generated(postflopRule({}), 5).postflopFacingState).toBeDefined();
        expect(generated(postflopRule({}), 5).preflopFacingState).toBeUndefined();
    });

    it('picks a street freely when the rule names none', () => {
        const anyStreet: PredicateRule = {
            kind: 'predicate', situation: {}, branches: [], default: { action: 'check' },
        };
        const seen = new Set<string>();
        for (let seed = 0; seed < 40; seed += 1) seen.add(generated(anyStreet, seed).street);
        expect(seen.size).toBeGreaterThan(1);
    });

    it('refuses a rule whose only villain seat is the hero\'s own — that is no table', () => {
        // This used to deal the spot with the villain unseated. A postflop
        // decision is always FACING somebody, and a rule that leaves nobody to
        // face describes a spot that cannot arise; the honest answer is the
        // table's veto, not a quiet blank.
        const result = generateScenario(
            postflopRule({ hero_position: ['BTN'], villain_position: ['BTN'] }),
            { seed: 1 },
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('spot-impossible');
    });

    it('seats the opponent where the action order allows', () => {
        // Preflop, "facing a raise" comes from a seat that acted earlier; the
        // button cannot be first to act postflop; a steal comes from late
        // position into the blinds. These were all violated before seating
        // was derived: a reader on the cutoff was shown a raise from the button.
        for (let seed = 0; seed < 40; seed += 1) {
            const raised = generated(preflopRule({
                situation: { street: 'preflop', hero_position: ['CO'], preflop_facing_state: ['facing_raise'] },
            }), seed, parseHands(['AA']));
            expect(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']).toContain(raised.villainPosition);

            const stolen = generated(preflopRule({
                situation: { street: 'preflop', hero_position: ['BB'], preflop_facing_state: ['facing_steal'] },
            }), seed, parseHands(['AA']));
            expect(['CO', 'BTN', 'SB']).toContain(stolen.villainPosition);

            const first = generated(postflopRule({ postflop_facing_state: ['first_to_act'] }), seed);
            expect(first.heroPosition).not.toBe('BTN');
        }
    });

    it('lets a rule that insists on a preflop pot type have it, coherent or not — the validator fights that', () => {
        for (let seed = 0; seed < 20; seed += 1) {
            const insisted = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['facing_limp'], pot_type: ['limped'] },
            }), seed, parseHands(['AA']));
            expect(insisted.potType).toBe('limped');
            // Unopened with a pot type demanded: the rule's word stands.
            const unopened = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['unopened'], pot_type: ['single_raised'] },
            }), seed, parseHands(['AA']));
            expect(unopened.potType).toBe('single_raised');
        }
    });
});
