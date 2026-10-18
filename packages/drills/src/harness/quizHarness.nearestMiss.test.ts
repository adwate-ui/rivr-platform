import { describe, it, expect } from 'vitest';
import type { PredicateRule, Principle, Situation } from '../ontology/types.ts';
import { nearestMiss, pageSpan } from './quizHarness.ts';
import { betPrinciple, FLOP_HAND, quizHand, readSpot } from './fixtures.ts';

/**
 * Joining a near miss by page before by coordinate.
 *
 * A quiz hand cites the pages whose principles it is meant to exercise. So when
 * nothing covers the hand, the question worth answering is "is the rule from
 * THOSE pages nearly right, or was that passage never encoded?", and those have
 * opposite repairs. Ranking on missed coordinates alone reports whichever rule
 * from anywhere in the source happens to constrain least, which reads as
 * "narrow this rule" when the truth is "encode that passage".
 */

const spot = readSpot(quizHand('q1', { ...FLOP_HAND, hero_position: 'BTN', pot_type: 'single_raised' }));

const flopRule = (situation: Situation): PredicateRule => ({
    kind: 'predicate', situation, branches: [], default: { action: 'bet' },
});

const at = (id: string, page: string, situation: Situation): Principle =>
    betPrinciple(id, { street: 'flop' }, { page_ref: page, rule: flopRule(situation) });

const near: Situation = { street: ['flop'], pot_type: ['limped'] };
const far: Situation = { street: ['flop'], pot_type: ['limped'], player_count: ['multiway'] };

describe('joining a near miss by page before by coordinate', () => {
    it('prefers the cited passage over a closer rule from elsewhere', () => {
        const miss = nearestMiss(spot, [at('elsewhere', '300-301', near), at('cited', '10-11', far)], '10-11');
        expect(miss?.principleId).toBe('cited');
        expect(miss?.samePage).toBe(true);
        // The closer rule really was closer. Page is why it lost.
        expect(miss?.blockedBy.length).toBeGreaterThan(1);
    });

    it('says so when the nearest rule is from other pages entirely', () => {
        // The signal that the passage is unencoded, not that a rule is too wide.
        const miss = nearestMiss(spot, [at('elsewhere', '300-301', near)], '10-11');
        expect(miss).toMatchObject({ principleId: 'elsewhere', samePage: false });
    });

    it('falls back to fewest missed coordinates within the cited pages', () => {
        const miss = nearestMiss(spot, [at('cited_far', '10-11', far), at('cited_near', '10-11', near)], '10-11');
        expect(miss?.principleId).toBe('cited_near');
    });

    it('ranks on coordinates alone when the hand cites no page', () => {
        const miss = nearestMiss(spot, [at('far', '10-11', far), at('near', '300', near)]);
        expect(miss).toMatchObject({ principleId: 'near', samePage: false });
    });

    it('treats overlapping spans as the same passage', () => {
        expect(nearestMiss(spot, [at('overlapping', '11-14', near)], '10-11')?.samePage).toBe(true);
    });
});

describe('reading a page reference', () => {
    it('reads a single page and a span', () => {
        expect(pageSpan(42)).toEqual([42, 42]);
        expect(pageSpan('30-41')).toEqual([30, 41]);
    });

    it('is null where none is stated or none can be read', () => {
        // A principle without a page cannot be same-page as anything, which is
        // what keeps an unreferenced rule from winning the page tier for free.
        expect(pageSpan(undefined)).toBeNull();
        expect(pageSpan('appendix')).toBeNull();
    });

    it('takes the outermost pages of a messy reference', () => {
        expect(pageSpan('see 12, 14-15 and the notes')).toEqual([12, 15]);
    });
});
