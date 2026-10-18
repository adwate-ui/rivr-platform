import { describe, it, expect, beforeEach } from 'vitest';
import type { PredicateRule, Street } from '../ontology/types.ts';
import { findOverlaps, isShadowed } from './determinacy.ts';
import { resetTagCompatibilityCache } from './tagCompatibility.ts';

beforeEach(() => resetTagCompatibilityCache());

describe('streets as a set (ontology 1.1)', () => {
    it('overlaps two branches on a shared street and separates them on disjoint ones', () => {
        const rule = (a: Street[], b: Street[]): PredicateRule => ({
            kind: 'predicate',
            situation: {},
            branches: [
                { when: { street: a, hand_class_any: ['set'] }, then: { action: 'bet' } },
                { when: { street: b, hand_class_any: ['set'] }, then: { action: 'check' } },
            ],
            default: { action: 'check' },
        });

        expect(findOverlaps(rule(['turn', 'river'], ['river']))).toHaveLength(1);
        expect(findOverlaps(rule(['flop'], ['river']))).toEqual([]);
        expect(findOverlaps(rule(['flop', 'turn'], ['river']))).toEqual([]);
    });

    it('shadows a branch whose streets are a subset of an earlier one', () => {
        expect(isShadowed({ street: ['turn', 'river'] }, { street: ['river'] })).toBe(true);
        expect(isShadowed({ street: ['river'] }, { street: ['turn', 'river'] })).toBe(false);
        expect(isShadowed({ street: ['river'] }, {})).toBe(false);
    });
});

describe('a street named on only one side', () => {
    const oneSided = (side: 'first' | 'second'): PredicateRule => ({
        kind: 'predicate',
        situation: {},
        branches: [
            {
                when: side === 'first' ? { street: ['flop'], board_require: ['paired'] } : { board_require: ['paired'] },
                then: { action: 'bet' },
            },
            {
                when: side === 'first' ? { board_require: ['high'] } : { street: ['flop'], board_require: ['high'] },
                then: { action: 'check' },
            },
        ],
        default: { action: 'check' },
    });

    it('takes the stated street whichever branch states it', () => {
        expect(findOverlaps(oneSided('first'))[0]?.witness.street).toBe('flop');
        expect(findOverlaps(oneSided('second'))[0]?.witness.street).toBe('flop');
    });

    it('asks any street when neither branch names one', () => {
        const neither: PredicateRule = {
            kind: 'predicate',
            situation: {},
            branches: [
                { when: { board_require: ['paired'] }, then: { action: 'bet' } },
                { when: { board_require: ['high'] }, then: { action: 'check' } },
            ],
            default: { action: 'check' },
        };
        const overlaps = findOverlaps(neither);
        expect(overlaps).toHaveLength(1);
        expect(overlaps[0]?.witness.street).toBeUndefined();
    });
});
