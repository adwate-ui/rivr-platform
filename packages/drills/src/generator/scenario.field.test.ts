import { describe, it, expect } from 'vitest';
import type { Position } from '../ontology/types.ts';
import { parseHands } from '../range/parse.ts';
import { POSTFLOP_ORDER, PREFLOP_ORDER } from './seating.ts';
import { generateScenario } from './scenario.ts';
import { generated, postflopRule, preflopRule } from './fixtures.ts';

/**
 * Who else is at the table: the field, the session's scope, the company a
 * facing state makes, and the bet size in front of the hero.
 */

describe('the table around the hero', () => {
    it('lets a rule insist on company the facing state would not produce — the rule has the last word', () => {
        for (let seed = 0; seed < 20; seed += 1) {
            const insisted = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['facing_raise'], player_count: ['multiway'] },
            }), seed, parseHands(['AA']));
            expect(insisted.playerCount).toBe('multiway');
        }
    });

    it('seats the rest of the field where it can actually be, and seats the hero where the field fits', () => {
        // First to act postflop means everyone else is still behind the hero,
        // so a multiway pot cannot be dealt from the cutoff (one seat behind)
        // and the field it deals is entirely behind whoever the hero is.
        const after = (hero: Position) => POSTFLOP_ORDER.slice(POSTFLOP_ORDER.indexOf(hero) + 1);
        let dealt = 0;
        for (let seed = 0; seed < 40; seed += 1) {
            const spot = generated(postflopRule({
                street: 'flop', postflop_facing_state: ['first_to_act'], player_count: ['multiway'],
            }), seed);
            dealt += 1;
            expect(spot.villainPositions.length).toBeGreaterThanOrEqual(3);
            expect(spot.villainPositions.every((seat) => after(spot.heroPosition).includes(seat))).toBe(true);
            expect(['CO', 'BTN']).not.toContain(spot.heroPosition);
        }
        expect(dealt).toBe(40);
        // Preflop the field has acted, so it sits ahead of the hero — and a
        // seat with two players ahead of it cannot be in a four-way limped pot.
        for (let seed = 0; seed < 40; seed += 1) {
            const spot = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['facing_limp'], player_count: ['multiway'] },
            }), seed, parseHands(['AA']));
            const ahead = PREFLOP_ORDER.slice(0, PREFLOP_ORDER.indexOf(spot.heroPosition));
            expect(spot.villainPositions.length).toBeGreaterThanOrEqual(3);
            expect(spot.villainPositions.every((seat) => ahead.includes(seat))).toBe(true);
        }
    });

    it('deals inside the session scope, not merely from a rule that overlaps it', () => {
        // A rule scoped to two games, asked in a 2/5 session, is a 2/5 spot
        // every time; a street scope narrows a two-street rule the same way.
        const rule = postflopRule({ street: ['turn', 'river'], stakes: ['2/5', '5/10'] });
        for (let seed = 0; seed < 30; seed += 1) {
            const result = generateScenario(rule, { seed, stakes: ['2/5'], streets: ['river'] });
            if (!result.ok) continue;
            expect(result.scenario.stakes).toBe('2/5');
            expect(result.scenario.street).toBe('river');
        }
        // A scope the rule does not share leaves the rule's own list standing —
        // the session should never have drawn it, and the validator is where
        // that is said.
        const stubborn = generateScenario(rule, { seed: 4, stakes: ['1/2'] });
        if (stubborn.ok) expect(['2/5', '5/10']).toContain(stubborn.scenario.stakes);
        // An unscoped rule takes the session's word for it.
        const unscoped = generateScenario(postflopRule({ street: 'flop' }), { seed: 4, stakes: ['5/10'] });
        if (unscoped.ok) expect(unscoped.scenario.stakes).toBe('5/10');
    });

    it('lets a rule insist on a preflop pot type the facing state would not make — the author has the last word', () => {
        for (let seed = 0; seed < 10; seed += 1) {
            const spot = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['facing_raise'], pot_type: ['three_bet'] },
            }), seed, parseHands(['AA']));
            expect(spot.potType).toBe('three_bet');
        }
    });

    it('derives the preflop pot type and company from what the hero is facing', () => {
        for (let seed = 0; seed < 40; seed += 1) {
            const open = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['unopened'] },
            }), seed, parseHands(['AA']));
            expect(open.potType).toBeUndefined();
            expect(open.villainPositions).toEqual([]);
            expect(open.sprBracket).toBeUndefined();

            const threeBet = generated(preflopRule({
                situation: { street: 'preflop', preflop_facing_state: ['facing_3bet'] },
            }), seed, parseHands(['AA']));
            expect(threeBet.potType).toBe('three_bet');
        }
    });

    it('leaves villain raise size unset unless the rule constrains it', () => {
        expect(generated(postflopRule({}), 2).villainRaiseSize).toBeUndefined();
        expect(generated(postflopRule({ villain_raise_size: ['large'] }), 2).villainRaiseSize).toBe('large');
    });

    it('keeps a four-bet pot heads-up', () => {
        // A third player cold-calling a four-bet is a table the drills never
        // describe, so a four-bet pot is dealt heads-up.
        for (let seed = 0; seed < 30; seed += 1) {
            const spot = generated(postflopRule({ pot_type: ['four_bet_plus'] }), seed);
            expect(spot.playerCount).toBe('heads_up');
        }
        // A rule that lists heads-up among bigger fields gets the heads-up one.
        for (let seed = 0; seed < 20; seed += 1) {
            const listed = generated(postflopRule({
                pot_type: ['four_bet_plus'], player_count: ['heads_up', 'three_way', 'multiway'],
            }), seed);
            expect(listed.playerCount).toBe('heads_up');
        }
        // A rule that insists on a bigger field and nothing else keeps its
        // claim; the validator is the one to call that incoherent.
        const insisted = generated(postflopRule({ pot_type: ['four_bet_plus'], player_count: ['multiway'] }), 3);
        expect(insisted.playerCount).toBe('multiway');
    });
});
