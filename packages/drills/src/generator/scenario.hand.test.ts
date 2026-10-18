import { describe, it, expect } from 'vitest';
import type { PredicateRule } from '../ontology/types.ts';
import { parseHands } from '../range/parse.ts';
import { comboIndex, hasCombo } from '../range/comboSet.ts';
import { generateScenario } from './scenario.ts';
import { generated, postflopRule, preflopRule } from './fixtures.ts';

/**
 * The hero's hand and the board it is dealt on, the line it is replayed from,
 * and the reasons a search gives when it finds nothing.
 */

describe('the hero hand', () => {
    it('comes from the rule range for a preflop lookup', () => {
        const range = parseHands(['AA', 'KK']);
        for (let seed = 0; seed < 20; seed += 1) {
            const scenario = generated(preflopRule(), seed, range);
            expect(hasCombo(range, comboIndex(scenario.hole[0], scenario.hole[1]))).toBe(true);
        }
    });

    it('satisfies a hand-class filter for a postflop predicate', () => {
        for (let seed = 0; seed < 15; seed += 1) {
            const scenario = generated(postflopRule({ hand_class_any: ['no_pair'] }), seed);
            expect(scenario.handClass).toBe('no_pair');
        }
    });

    it('spreads a hand-class list evenly instead of dealing the deck\'s own odds', () => {
        // Random hole cards make no pair about six times in ten, so a rule
        // listing several classes got them in deck proportion: drills about
        // strong hands were three-quarters seven-high folds.
        const classes = ['no_pair', 'weak_pair', 'second_pair', 'top_pair_good_kicker'] as const;
        const counts = new Map<string, number>();
        for (let seed = 0; seed < 200; seed += 1) {
            const spot = generated(postflopRule({ hand_class_any: [...classes] }), seed);
            expect(classes).toContain(spot.handClass);
            const handClass = spot.handClass ?? 'none';
            counts.set(handClass, (counts.get(handClass) ?? 0) + 1);
        }
        // Every class gets a real share of the spots, and none of them runs
        // away with the drill.
        for (const handClass of classes) {
            expect(counts.get(handClass) ?? 0).toBeGreaterThan(20);
        }
        expect(Math.max(...counts.values()) / 200).toBeLessThan(0.45);
    });

    it('deals a hand the source would have played, when the story says the hero raised', () => {
        // The story said "under the gun raises" and the cards said Q-4
        // offsuit, on 91% of one rule's spots. `playable` is the source's own
        // opening list for the seat, read back off its preflop rules.
        const opens = parseHands(['AA', 'KK', 'AKs']);
        const rule = postflopRule({ hero_position: ['UTG'], node_path: ['hero_preflop_raise'] });
        for (let seed = 0; seed < 25; seed += 1) {
            const spot = generated(rule, seed, undefined, { playable: () => opens });
            expect(hasCombo(opens, comboIndex(spot.hole[0], spot.hole[1]))).toBe(true);
        }
        // A seat and action the source never speaks for leaves the deal free.
        const silent = generateScenario(rule, { seed: 1, playable: () => undefined });
        expect(silent.ok).toBe(true);
    });

    it('asks the line check only where the hero has an earlier street to answer for', () => {
        // `playable` covers preflop; this covers the flop and the turn. The
        // check is not free — it rewinds the spot and arbitrates — so it is
        // asked once per rule rather than of every hand, and a rule whose line
        // has no earlier hero action never pays for it.
        let asked = 0;
        const counting = (): boolean => { asked += 1; return true; };

        // Preflop: nothing to answer for.
        generateScenario(preflopRule(), { seed: 1, range: parseHands(['AA']), lineFits: counting });
        expect(asked).toBe(0);

        // A postflop line whose only hero step is on the decision street.
        generateScenario(postflopRule({ node_path: ['hero_flop_bet'] }), { seed: 1, lineFits: counting });
        expect(asked).toBe(0);

        // A turn spot after a flop the hero bet: now there is something to ask.
        const barrel: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'turn', node_path: ['hero_flop_bet', 'villain_flop_call'] },
            branches: [],
            default: { action: 'bet' },
        };
        const result = generateScenario(barrel, { seed: 1, lineFits: counting });
        expect(result.ok).toBe(true);
        expect(asked).toBeGreaterThan(0);
    });

    it('says line-not-found when the hand fitted the rule but not the hero’s earlier streets', () => {
        // Told apart from `hand-not-found` on purpose: the boards matched and
        // hands fitted them, and what ran out was hands the source would have
        // played the flop the way the story says the hero played it. The fix
        // is in the encoding of the earlier street, not of this rule's board.
        const barrel: PredicateRule = {
            kind: 'predicate',
            situation: { street: 'turn', node_path: ['hero_flop_bet', 'villain_flop_call'] },
            branches: [],
            default: { action: 'bet' },
        };
        const result = generateScenario(barrel, { seed: 1, lineFits: () => false, boardAttemptLimit: 20 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('line-not-found');
    });

    it('satisfies a draw filter', () => {
        const scenario = generated(postflopRule({ draw_class_any: ['flush_draw'] }), 11);
        expect(scenario.draws).toContain('flush_draw');
    });

    it('satisfies a relative-strength filter', () => {
        const scenario = generated(postflopRule({ relative_strength_any: ['weak'] }), 13);
        expect(scenario.relativeStrength).toBe('weak');
    });

    it('never deals a card that is already on the board', () => {
        for (let seed = 0; seed < 60; seed += 1) {
            const scenario = generated(postflopRule({ street: 'river' }), seed);
            const all = [...scenario.board, ...scenario.hole].map((card) => `${card.rank}${card.suit}`);
            expect(new Set(all).size).toBe(all.length);
        }
    });
});

describe('the board', () => {
    it('carries every required tag and none of the excluded ones', () => {
        for (let seed = 0; seed < 20; seed += 1) {
            const scenario = generated(
                postflopRule({ board_require: ['monotone'], board_exclude: ['paired'] }),
                seed,
            );
            expect(scenario.boardTags).toContain('monotone');
            expect(scenario.boardTags).not.toContain('paired');
        }
    });
});

describe('node_path', () => {
    it('is copied verbatim and never extended', () => {
        const path = ['btn_raise_medium', 'bb_call'];
        const scenario = generated(postflopRule({ node_path: path }), 1);
        expect(scenario.nodePath).toEqual(path);
    });

    it('is empty when the rule authored none, rather than invented', () => {
        expect(generated(postflopRule({}), 1).nodePath).toEqual([]);
    });

    it('does not alias the rule, so a scenario cannot mutate its principle', () => {
        const path = ['a'];
        const rule = postflopRule({ node_path: path });
        const scenario = generated(rule, 1);
        expect(scenario.nodePath).not.toBe(path);
    });
});

describe('when it cannot find one', () => {
    it('says board-not-found when no board it drew could ever match', () => {
        const impossible = postflopRule({ board_require: ['monotone', 'rainbow'] });
        const result = generateScenario(impossible, { seed: 1, boardAttemptLimit: 25 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('board-not-found');
            expect(result.attempts).toBe(25);
        }
    });

    it('says hand-not-found when boards matched but no hand fitted them', () => {
        // Rainbow flops are common; a flush on one is impossible, because a
        // flush needs three of a suit showing. Impossible rather than merely
        // rare on purpose: this used to ask for a full house on a monotone
        // flop, which the hand search now actually finds — it was only ever
        // "unfindable" because the search gave up after ~23 tries per board
        // regardless of the limit it was handed.
        const impossible = postflopRule({ board_require: ['rainbow'], hand_class_any: ['flush'] });
        const result = generateScenario(impossible, { seed: 1, boardAttemptLimit: 40 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('hand-not-found');
    });

    it('reports a preflop range it cannot place as a hand failure', () => {
        // An empty range has nothing to draw from, and no number of board
        // shuffles will change that.
        const result = generateScenario(preflopRule(), {
            seed: 1,
            range: parseHands([]),
            boardAttemptLimit: 5,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('hand-not-found');
    });
});
