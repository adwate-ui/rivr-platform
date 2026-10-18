import { describe, it, expect } from 'vitest';
import type { Principle } from '../ontology/types.ts';
import { arbitrate, governingPrinciple, rankCandidates, compareRanked, type Ranked } from './arbitrate.ts';
import { makeRng } from '../prng.ts';
import { alwaysBets as principle, turnSpot as scenario } from './fixtures.ts';

/**
 * Arbitration's tie-breaks, and the property the original defect violated.
 *
 * When several principles matched a spot, nothing decided between them and the
 * caller took the first. The shuffle-invariance tests below would have caught
 * it: under declaration-order selection they fail on the first reordering.
 */

describe('the tie-breaks, each in isolation', () => {
    const spot = scenario();

    it('1. narrower street set wins at equal specificity', () => {
        const wide = principle('wide', { street: ['turn', 'river'], hero_position: ['BTN'] });
        const narrow = principle('narrow', { street: ['turn'], hero_position: ['BTN'] });
        expect(governingPrinciple(spot, [wide, narrow])?.id).toBe('narrow');
        expect(governingPrinciple(spot, [narrow, wide])?.id).toBe('narrow');
    });

    it('2. more constrained branch conditions wins, when the streets are equal too', () => {
        const plain = principle('plain', { street: ['turn'], hero_position: ['BTN'] });
        const branched = principle('branched', { street: ['turn'], hero_position: ['BTN'] }, {
            rule: {
                kind: 'predicate',
                situation: { street: ['turn'], hero_position: ['BTN'] },
                branches: [{ when: { hand_class_any: ['top_pair_good_kicker'] }, then: { action: 'bet' } }],
                default: { action: 'check' },
            },
        });
        expect(governingPrinciple(spot, [plain, branched])?.id).toBe('branched');
        expect(governingPrinciple(spot, [branched, plain])?.id).toBe('branched');
    });

    it('3. declaration order, and only when everything else is equal', () => {
        const first = principle('first', { street: ['turn'], hero_position: ['BTN'] });
        const second = principle('second', { street: ['turn'], hero_position: ['BTN'] });
        expect(governingPrinciple(spot, [first, second])?.id).toBe('first');
        expect(governingPrinciple(spot, [second, first])?.id).toBe('second');
    });

    it('applies the tie-breaks in precedence, not by whichever fires first', () => {
        // `wideStreetManyBranches` wins tie-break 2 and loses tie-break 1.
        // Street is checked first, so it must lose overall.
        const narrowStreet = principle('narrowStreet', { street: ['turn'], hero_position: ['BTN'] });
        const wideStreetManyBranches = principle(
            'wideStreetManyBranches',
            { street: ['turn', 'river'], hero_position: ['BTN'] },
            {
                rule: {
                    kind: 'predicate',
                    situation: { street: ['turn', 'river'], hero_position: ['BTN'] },
                    branches: [
                        { when: { hand_class_any: ['top_pair_good_kicker'], pot_type: ['limped'] }, then: { action: 'bet' } },
                    ],
                    default: { action: 'check' },
                },
            },
        );
        expect(governingPrinciple(spot, [wideStreetManyBranches, narrowStreet])?.id).toBe('narrowStreet');
    });

    it('lets specificity beat every tie-break', () => {
        // The wider-street, branch-heavy rule is MORE specific, so it wins
        // before any tie-break is consulted.
        const specific = principle('specific', {
            street: ['turn', 'river'], hero_position: ['BTN'], pot_type: ['single_raised'],
        });
        const narrowStreet = principle('narrowStreet', { street: ['turn'], hero_position: ['BTN'] });
        expect(governingPrinciple(spot, [narrowStreet, specific])?.id).toBe('specific');
    });
});

describe('the comparator itself', () => {
    const ranked = (over: Partial<Ranked>): Ranked => ({
        principle: principle('x', {}),
        specificity: 1,
        streetWidth: 1,
        branchSpecificity: 0,
        declarationIndex: 0,
        ...over,
    });

    it('is antisymmetric, so a sort cannot depend on which side it visits first', () => {
        const pairs: [Partial<Ranked>, Partial<Ranked>][] = [
            [{ specificity: 3 }, { specificity: 1 }],
            [{ streetWidth: 1 }, { streetWidth: 4 }],
            [{ branchSpecificity: 2 }, { branchSpecificity: 0 }],
            [{ declarationIndex: 0 }, { declarationIndex: 5 }],
        ];
        pairs.forEach(([left, right]) => {
            const a = ranked(left);
            const b = ranked(right);
            expect(compareRanked(a, b)).toBeLessThan(0);
            expect(compareRanked(b, a)).toBeGreaterThan(0);
        });
    });

    it('is total: only an identical declaration index compares equal', () => {
        expect(compareRanked(ranked({}), ranked({}))).toBe(0);
    });
});

describe('determinism', () => {
    /**
     * Shuffling with a seeded PRNG rather than Math.random keeps a failure
     * reproducible — an arbitration bug that only shows up one run in twenty is
     * worse than no test.
     */
    const shuffle = <T>(items: readonly T[], seed: number): T[] => {
        const rng = makeRng(seed);
        const out = [...items];
        for (let i = out.length - 1; i > 0; i -= 1) {
            const j = rng.nextInt(i + 1);
            const at = out[i];
            const swap = out[j];
            if (at === undefined || swap === undefined) continue;
            out[i] = swap;
            out[j] = at;
        }
        return out;
    };

    const pool: Principle[] = [
        principle('s0_wide', {}),
        principle('s1_turn', { street: ['turn'] }),
        principle('s1_pos', { street: ['turn'], hero_position: ['BTN'] }),
        principle('s2_pot', { street: ['turn'], hero_position: ['BTN'], pot_type: ['single_raised'] }),
        principle('s2_wide_street', { street: ['turn', 'river'], hero_position: ['BTN'], pot_type: ['single_raised'] }),
        principle('s4', {
            street: ['turn'], hero_position: ['BTN'], pot_type: ['single_raised'],
            player_count: ['heads_up'], villain_types: ['opp_nit'],
        }),
        principle('s1_river', { street: ['river'], hero_position: ['BTN'] }),
        principle('concept', {}, { drillable: false }),
    ];

    it('returns the same winner no matter what order the candidates arrive in', () => {
        const spot = scenario();
        const expected = governingPrinciple(spot, pool)?.id;
        expect(expected).toBe('s4');

        for (let seed = 1; seed <= 200; seed += 1) {
            expect(governingPrinciple(spot, shuffle(pool, seed))?.id).toBe(expected);
        }
    });

    it('holds for the runner-up too, not only the winner', () => {
        const spot = scenario();
        const expected = arbitrate(spot, pool).runnerUp?.id;
        for (let seed = 1; seed <= 100; seed += 1) {
            expect(arbitrate(spot, shuffle(pool, seed)).runnerUp?.id).toBe(expected);
        }
    });

    it('produces a stable full ranking, not merely a stable head', () => {
        const spot = scenario();
        const expected = rankCandidates(spot, pool).map((entry) => entry.principle.id);
        for (let seed = 1; seed <= 100; seed += 1) {
            // Only the exact ties may move, and this pool has none: every
            // candidate differs on specificity, street width or branch count.
            expect(rankCandidates(spot, shuffle(pool, seed)).map((e) => e.principle.id))
                .toEqual(expected);
        }
    });

    it('gives the same answer to the same question twice', () => {
        const spot = scenario();
        expect(governingPrinciple(spot, pool)?.id).toBe(governingPrinciple(spot, pool)?.id);
    });
});
