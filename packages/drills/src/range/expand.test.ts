import { describe, it, expect } from 'vitest';
import type { RangeSet } from '../ontology/types.ts';
import { countCombos, equalCombos, intersectCombos, type ComboSet } from './comboSet.ts';
import { expandRangeSets, RangeCycleError, UnknownParentError, EmptyRangeError } from './expand.ts';

/**
 * The derivation graph: a range set may name a parent, and excludes apply last.
 */

const set = (over: Partial<RangeSet> & { id: string }): RangeSet => ({ hands: [], ...over });

/** One expanded range, which the test expects to exist. */
const rangeOf = (map: ReadonlyMap<string, ComboSet>, id: string): ComboSet => {
    const range = map.get(id);
    if (range === undefined) throw new Error(`No range ${id}`);
    return range;
};

describe('expanding range sets', () => {
    it('expands a plain set', () => {
        const map = expandRangeSets([set({ id: 'a', hands: ['AA', 'KK'] })]);
        expect(countCombos(rangeOf(map, 'a'))).toBe(12);
    });

    it('unions a child with its parent', () => {
        const map = expandRangeSets([
            set({ id: 'parent', hands: ['AA'] }),
            set({ id: 'child', derived_from: 'parent', hands: ['KK'] }),
        ]);
        expect(countCombos(rangeOf(map, 'child'))).toBe(12);
        expect(countCombos(rangeOf(map, 'parent'))).toBe(6);
    });

    it('resolves a chain of derivations', () => {
        const map = expandRangeSets([
            set({ id: 'a', hands: ['AA'] }),
            set({ id: 'b', derived_from: 'a', hands: ['KK'] }),
            set({ id: 'c', derived_from: 'b', hands: ['QQ'] }),
        ]);
        expect(countCombos(rangeOf(map, 'c'))).toBe(18);
    });

    it('resolves a parent declared after its child', () => {
        const map = expandRangeSets([
            set({ id: 'child', derived_from: 'parent', hands: ['KK'] }),
            set({ id: 'parent', hands: ['AA'] }),
        ]);
        expect(countCombos(rangeOf(map, 'child'))).toBe(12);
    });

    it('applies excludes after the union, so a parent hand can be removed', () => {
        const map = expandRangeSets([
            set({ id: 'parent', hands: ['AA', 'KK'] }),
            set({ id: 'child', derived_from: 'parent', hands: ['QQ'], excludes: ['KK'] }),
        ]);
        expect(countCombos(rangeOf(map, 'child'))).toBe(12); // AA + QQ
    });

    it('leaves the parent untouched when a child excludes from it', () => {
        const map = expandRangeSets([
            set({ id: 'parent', hands: ['AA', 'KK'] }),
            set({ id: 'child', derived_from: 'parent', hands: [], excludes: ['KK'] }),
        ]);
        expect(countCombos(rangeOf(map, 'parent'))).toBe(12);
    });

    it('refuses a set that excludes everything it contains', () => {
        expect(() => expandRangeSets([set({ id: 'a', hands: ['AA'], excludes: ['AA'] })]))
            .toThrow(EmptyRangeError);
    });

    it('names the cycle rather than recursing forever', () => {
        expect(() => expandRangeSets([
            set({ id: 'a', derived_from: 'b', hands: ['AA'] }),
            set({ id: 'b', derived_from: 'a', hands: ['KK'] }),
        ])).toThrow(RangeCycleError);
    });

    it('catches a set deriving from itself', () => {
        expect(() => expandRangeSets([set({ id: 'a', derived_from: 'a', hands: ['AA'] })]))
            .toThrow(RangeCycleError);
    });

    it('names a parent that does not exist', () => {
        expect(() => expandRangeSets([set({ id: 'a', derived_from: 'ghost', hands: ['AA'] })]))
            .toThrow(UnknownParentError);
    });

    it('is idempotent — expanding twice gives the same combinations', () => {
        const sets = [
            set({ id: 'parent', hands: ['77+', 'A5s+'] }),
            set({ id: 'child', derived_from: 'parent', hands: ['KQo'], excludes: ['77'] }),
        ];
        const first = expandRangeSets(sets);
        const second = expandRangeSets(sets);
        expect(equalCombos(rangeOf(first, 'child'), rangeOf(second, 'child'))).toBe(true);
    });

    it('makes a widened range a strict superset of what it derives from', () => {
        const map = expandRangeSets([
            set({ id: 'tight', hands: ['22+', 'A2s+'] }),
            set({ id: 'wide', derived_from: 'tight', hands: ['K5s+', 'Q7s+'] }),
        ]);
        const tight = rangeOf(map, 'tight');
        const wide = rangeOf(map, 'wide');
        expect(equalCombos(intersectCombos(tight, wide), tight)).toBe(true);
        expect(countCombos(wide)).toBeGreaterThan(countCombos(tight));
    });
});
