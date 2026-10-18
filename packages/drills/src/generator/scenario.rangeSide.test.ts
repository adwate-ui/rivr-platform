import { describe, it, expect } from 'vitest';
import type { PredicateRule } from '../ontology/types.ts';
import { parseHands } from '../range/parse.ts';
import { generateScenario, rangeSideFor } from './scenario.ts';
import { postflopRule, preflopRule } from './fixtures.ts';

/**
 * Which side of a range the hero is dealt, and what the caller may refuse.
 */

describe('which side of the range the hero is dealt', () => {
    /**
     * The bug this exists to prevent: a rule that authored only `out_of_range`
     * answers nothing at all if the hero is always dealt IN range. Six
     * principles in the first encoded corpus were dead that way, and with them
     * the most common preflop decision of all: the fold.
     */
    const aces = parseHands(['AA']);
    const preflopRule: PredicateRule = {
        kind: 'predicate',
        situation: { street: 'preflop' },
        branches: [],
        default: { action: 'fold' },
    };

    const holeOf = (seed: number, rangeSide?: 'in' | 'out') => {
        const result = generateScenario(preflopRule, { seed, range: aces, rangeSide });
        if (!result.ok) throw new Error(`generation failed: ${result.reason}`);
        return result.scenario.hole.map((card) => card.rank).sort().join('');
    };

    it('deals from inside the range by default', () => {
        expect(holeOf(4)).toBe('AA');
    });

    it('deals from inside the range when asked for "in"', () => {
        expect(holeOf(4, 'in')).toBe('AA');
    });

    it('deals from outside the range when asked for "out"', () => {
        // Any two cards that are not a pair of aces.
        expect(holeOf(4, 'out')).not.toBe('AA');
    });

    it('never deals a hand from inside the range on the out side', () => {
        for (let seed = 1; seed <= 40; seed += 1) {
            expect(holeOf(seed, 'out')).not.toBe('AA');
        }
    });
});

/**
 * Which half of a range gets drilled.
 *
 * The bug this closes: the session dealt in-range whenever `in_range` was
 * authored, so on a two-sided opening rule the reader practised raising the
 * few hands an opening range holds and never once practised folding the rest —
 * the more common decision by a wide margin.
 */
describe('choosing a side of the range', () => {
    it('deals the only side a one-sided rule can answer', () => {
        // Dealing in-range to an `out_of_range`-only rule made it abstain on
        // every spot it was ever given; six principles were dead this way.
        const { in_range: _inside, ...foldsOnly } = preflopRule();
        const { out_of_range: _outside, ...raisesOnly } = preflopRule();
        expect(rangeSideFor(foldsOnly, 2)).toBe('out');
        expect(rangeSideFor(raisesOnly, 2)).toBe('in');
    });

    it('drills both halves of a two-sided rule', () => {
        const rule = preflopRule();
        const sides = new Set([1, 2, 3, 4].map((seed) => rangeSideFor(rule, seed)));
        expect(sides).toEqual(new Set(['in', 'out']));
    });

    it('picks the same side for the same seed, so a spot is reproducible', () => {
        expect(rangeSideFor(preflopRule(), 7)).toBe(rangeSideFor(preflopRule(), 7));
    });

    it('has nothing to say about a rule with no range', () => {
        const predicateRule: PredicateRule = {
            kind: 'predicate', situation: {}, branches: [], default: { action: 'check' },
        };
        expect(rangeSideFor(predicateRule, 1)).toBeUndefined();
    });
});

describe('refusing a candidate the caller cannot use', () => {
    it('reports rule-abstains when every candidate is rejected', () => {
        // Distinguished from hand-not-found on purpose: the boards matched and
        // the hands were found, so the source's problem is that it has nothing
        // to SAY about the spots it admits, not that it asked for a bad board.
        const rule = postflopRule({});
        const result = generateScenario(rule, {
            seed: 3,
            accept: () => false,
            boardAttemptLimit: 5,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe('rule-abstains');
    });

    it('returns the first candidate the caller accepts', () => {
        const rule = postflopRule({});
        const seen: string[] = [];
        const result = generateScenario(rule, {
            seed: 3,
            // Refuse the first two, so acceptance is doing the choosing rather
            // than the search happening to stop.
            accept: (candidate) => {
                seen.push(candidate.hole.map((c) => c.rank).join(''));
                return seen.length > 2;
            },
        });
        expect(result.ok).toBe(true);
        expect(seen.length).toBe(3);
    });
});

describe('a ranged hand that collides with the board', () => {
    it('redraws rather than dealing a card that is already showing', () => {
        // A one-combo range on a postflop rule: roughly a fifth of flops contain
        // one of those two cards, so the clash path is exercised, and the hand
        // dealt must never duplicate a board card.
        const single = parseHands(['AA']);
        const rule = postflopRule({});
        let dealt = 0;

        for (let seed = 1; seed <= 30; seed += 1) {
            const result = generateScenario(rule, { seed, range: single });
            if (!result.ok) continue;
            dealt += 1;
            const { board, hole } = result.scenario;
            for (const held of hole) {
                expect(board.some((card) => card.rank === held.rank && card.suit === held.suit))
                    .toBe(false);
            }
        }

        expect(dealt).toBeGreaterThan(0);
    });
});
