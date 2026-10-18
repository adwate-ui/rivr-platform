import { describe, it, expect } from 'vitest';
import type { Situation } from '../ontology/types.ts';
import {
    arbitrate, governingPrinciple, rankCandidates,
    specificity, streetWidth, branchSpecificity, SPECIFICITY_SLOTS,
} from './arbitrate.ts';
import { alwaysBets as principle, turnSpot as scenario } from './fixtures.ts';

/**
 * Match arbitration: what the ranking counts, and who wins.
 *
 * The defect these tests exist for: when several principles matched a spot,
 * nothing decided between them and the caller took the first, so the answer was
 * a function of where a principle sat in the file. `arbitrateOrder.test.ts`
 * holds the tie-breaks and the shuffle-invariance property that pins it.
 *
 * Fixtures are deliberately synthetic. A rule that says "always bet" is not
 * poker advice; arbitration's job is mechanical (which rule is narrower?) and
 * making the fixtures read like strategy would test the same code while
 * inviting them to be read as recommendations.
 */

describe('counting how specific a situation is', () => {
    it('counts each constrained coordinate once', () => {
        expect(specificity({})).toBe(0);
        expect(specificity({ hero_position: ['BTN'] })).toBe(1);
        expect(specificity({
            hero_position: ['BTN'], pot_type: ['single_raised'],
            player_count: ['heads_up'], villain_types: ['opp_nit'],
        })).toBe(4);
    });

    it('does not count street, which every principle names', () => {
        // Counting it would add one to everybody and discriminate nothing.
        expect(specificity({ street: ['turn'] })).toBe(0);
        expect(specificity({ street: ['turn'], hero_position: ['BTN'] })).toBe(1);
    });

    it('does not count node_path, which describes how a spot was reached', () => {
        expect(specificity({ node_path: ['preflop_raise'] })).toBe(0);
    });

    it('does not count a coordinate that is present but empty', () => {
        // An empty list constrains nothing. Stage 4 reports that shape; here it
        // must simply not earn the principle a rank it has not paid for.
        expect(specificity({ hero_position: [] })).toBe(0);
    });

    it('counts every slot the table names, so a new one is a decision', () => {
        // Every counted slot, constrained. A slot added to the table and not
        // here fails both assertions, which is the point.
        const everything: Situation = {
            stakes: ['1/2'], hero_position: ['BTN'], villain_position: ['BB'], pot_type: ['limped'],
            player_count: ['heads_up'], stack_bracket: ['short'], spr_bracket: ['low'],
            preflop_facing_state: ['unopened'], postflop_facing_state: ['facing_bet'],
            villain_raise_size: ['small'], villain_types: ['x'], board_require: ['paired'],
            board_exclude: ['monotone'], hand_class_any: ['set'], draw_class_any: ['none'],
            draw_class_exclude: ['gutshot'], relative_strength_any: ['nuts'], runout_any: ['brick'],
            runout_exclude: ['overcard'],
        };
        expect(Object.keys(everything).sort()).toEqual([...SPECIFICITY_SLOTS].sort());
        expect(specificity(everything)).toBe(SPECIFICITY_SLOTS.length);
    });
});

describe('street width', () => {
    it('reads an unstated street as the widest claim, not a neutral one', () => {
        expect(streetWidth({})).toBe(4);
        expect(streetWidth({ street: ['turn'] })).toBe(1);
        expect(streetWidth({ street: ['turn', 'river'] })).toBe(2);
        // The schema allows a bare string.
        expect(streetWidth({ street: 'flop' })).toBe(1);
    });
});

describe('branch specificity', () => {
    it('sums the constrained coordinates across every branch condition', () => {
        expect(branchSpecificity(principle('p', {}, {
            rule: {
                kind: 'predicate',
                situation: {},
                branches: [
                    { when: { hand_class_any: ['set'] }, then: { action: 'bet' } },
                    { when: { hand_class_any: ['top_pair_good_kicker'], pot_type: ['limped'] }, then: { action: 'check' } },
                ],
                default: { action: 'check' },
            },
        }))).toBe(3);
    });

    it('is zero for a range lookup, which has no branches', () => {
        expect(branchSpecificity(principle('p', {}, {
            rule: {
                kind: 'range_lookup',
                situation: { street: ['preflop'] },
                range_set_id: 'rs',
                in_range: { action: 'raise' },
                out_of_range: { action: 'fold' },
            },
        }))).toBe(0);
    });

    it('reads the override rule when one is actually in force', () => {
        // `effectiveRule` applies an override only at status `overridden`, and
        // arbitration follows GRADING here rather than the validator, which
        // inspects an override whatever its status. Ranking by a rule that is
        // not the one answering would be the exact drift this module exists to
        // prevent.
        expect(branchSpecificity(principle('p', {}, {
            status: 'overridden',
            override_rule: {
                kind: 'predicate',
                situation: {},
                branches: [{ when: { pot_type: ['limped'] }, then: { action: 'bet' } }],
                default: { action: 'check' },
            },
        }))).toBe(1);
    });
});

describe('what kind of answer is being asked for', () => {
    const spot = scenario();

    /*
     * The failure this filter prevents is quiet rather than loud: a more
     * specific ACTION rule governs a "strong fit or weak fit?" spot, the
     * reader's label is graded against `raise`, and nothing anywhere reports a
     * problem.
     */

    it('asks for an action unless told otherwise, so every existing caller is unaffected', () => {
        const pool = [principle('a', { street: ['turn'] })];
        expect(rankCandidates(spot, pool)).toHaveLength(1);
        expect(rankCandidates(spot, pool, { ranges: new Map() })).toHaveLength(1);
        expect(rankCandidates(spot, pool, { ranges: new Map(), answerKind: 'action' })).toHaveLength(1);
    });

    it('ranks nothing when the question is one this source cannot answer', () => {
        // A source of action rules has no candidate for a label or a count.
        // Better to govern nothing than to answer the wrong question well.
        const pool = [
            principle('a', { street: ['turn'] }),
            principle('b', { street: ['turn'], hero_position: ['BTN'] }),
        ];
        expect(rankCandidates(spot, pool, { ranges: new Map(), answerKind: 'classify' })).toEqual([]);
        expect(rankCandidates(spot, pool, { ranges: new Map(), answerKind: 'count' })).toEqual([]);
        expect(arbitrate(spot, pool, { ranges: new Map(), answerKind: 'classify' }).governing).toBeNull();
    });
});

describe('choosing between principles that all match', () => {
    const spot = scenario();

    it('gives it to the most specific one, whatever the declaration order', () => {
        const wide1 = principle('wide1', { street: ['turn'], hero_position: ['BTN'] });
        const wide2 = principle('wide2', { street: ['turn'], pot_type: ['single_raised'] });
        const narrow = principle('narrow', {
            street: ['turn'], hero_position: ['BTN'], pot_type: ['single_raised'],
            player_count: ['heads_up'], villain_types: ['opp_nit'],
        });

        // Specificity 4, 2, 2 — the four wins from every position in the list.
        expect(governingPrinciple(spot, [narrow, wide1, wide2])?.id).toBe('narrow');
        expect(governingPrinciple(spot, [wide1, narrow, wide2])?.id).toBe('narrow');
        expect(governingPrinciple(spot, [wide1, wide2, narrow])?.id).toBe('narrow');
    });

    it('reports how many matched before it narrowed them to one', () => {
        const result = arbitrate(spot, [
            principle('a', { street: ['turn'] }),
            principle('b', { street: ['turn'], hero_position: ['BTN'] }),
            principle('c', { street: ['river'] }),
        ]);
        expect(result.candidateCount).toBe(2);
        expect(result.governing?.id).toBe('b');
        expect(result.runnerUp?.id).toBe('a');
        expect(result.governingSpecificity).toBe(1);
    });

    it('says nothing governs when nothing matches', () => {
        const result = arbitrate(spot, [principle('r', { street: ['river'] })]);
        expect(result.governing).toBeNull();
        expect(result.runnerUp).toBeNull();
        expect(result.candidateCount).toBe(0);
        expect(result.governingSpecificity).toBe(0);
        expect(governingPrinciple(spot, [])).toBeNull();
    });

    it('has no runner-up when exactly one principle matched', () => {
        expect(arbitrate(spot, [principle('only', { street: ['turn'] })]).runnerUp).toBeNull();
    });

    it('never lets a concept principle govern', () => {
        // Its rule is an empty-situation placeholder, so it matches everything.
        const concept = principle('concept', {}, { drillable: false });
        expect(governingPrinciple(spot, [concept])).toBeNull();
        expect(governingPrinciple(spot, [concept, principle('real', { street: ['turn'] })])?.id)
            .toBe('real');
    });
});
