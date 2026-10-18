import { describe, it, expect } from 'vitest';
import { cardOrThrow as card } from '../cards/cards.ts';
import {
    COMBO_COUNT,
    emptyCombos,
    fullCombos,
    addCombo,
    hasCombo,
    countCombos,
    comboIndex,
    comboCards,
    comboLabel,
    unionCombos,
    subtractCombos,
    intersectCombos,
    equalCombos,
    cellCombos,
} from './comboSet.ts';
import { parseRangeNotation } from './parse.ts';

/**
 * The bitset every range is stored in.
 *
 * Combination COUNTS are the assertions that matter. "AKs" being four
 * combinations and "AKo" twelve is not a detail — it is the difference between
 * a preflop range that is 15% of hands and one that is 40%, and every drill
 * generated from a mis-parsed range asks about a spot the author never wrote.
 */


const count = (notation: string): number => countCombos(parseRangeNotation(notation));

describe('the bitset', () => {
    it('addresses all 1,326 combinations, uniquely and reversibly', () => {
        const seen = new Set<number>();
        for (let index = 0; index < COMBO_COUNT; index += 1) {
            const [a, b] = comboCards(index);
            expect(comboIndex(a, b)).toBe(index);
            expect(comboIndex(b, a)).toBe(index); // order-independent
            seen.add(index);
        }
        expect(seen.size).toBe(COMBO_COUNT);
    });

    it('starts empty and records what it is given', () => {
        const set = emptyCombos();
        expect(countCombos(set)).toBe(0);

        const index = comboIndex(card('Ah'), card('Kh'));
        expect(hasCombo(set, index)).toBe(false);
        addCombo(set, index);
        expect(hasCombo(set, index)).toBe(true);
        expect(countCombos(set)).toBe(1);
    });

    it('is idempotent on a repeated add', () => {
        const set = emptyCombos();
        const index = comboIndex(card('Ah'), card('Kh'));
        addCombo(set, index);
        addCombo(set, index);
        expect(countCombos(set)).toBe(1);
    });

    it('unions, subtracts and intersects', () => {
        const aces = cellCombos('A', 'A', 'pair');
        const kings = cellCombos('K', 'K', 'pair');

        expect(countCombos(unionCombos(aces, kings))).toBe(12);
        expect(countCombos(subtractCombos(unionCombos(aces, kings), kings))).toBe(6);
        expect(countCombos(intersectCombos(aces, kings))).toBe(0);
        expect(equalCombos(intersectCombos(unionCombos(aces, kings), aces), aces)).toBe(true);
        expect(equalCombos(aces, kings)).toBe(false);
    });

    it('labels a combination by its grid cell', () => {
        expect(comboLabel(card('Ah'), card('Kh'))).toBe('AKs');
        expect(comboLabel(card('Ah'), card('Kd'))).toBe('AKo');
        expect(comboLabel(card('Kd'), card('Ah'))).toBe('AKo'); // order-independent
        expect(comboLabel(card('Qh'), card('Qd'))).toBe('QQ');
    });
});

describe('combination counts', () => {
    it.each([
        ['AA', 6],
        ['AKs', 4],
        ['AKo', 12],
        ['AK', 16],
    ])('%s is %i combinations', (notation, expected) => {
        expect(count(notation)).toBe(expected);
    });

    it('adds up to the whole deck when every cell is included', () => {
        const all = emptyCombos();
        for (let index = 0; index < COMBO_COUNT; index += 1) addCombo(all, index);
        expect(countCombos(all)).toBe(1326);
    });
});

describe('the full deck as a combo set', () => {
    /**
     * The complement base. A rule that says what to do with the hands OUTSIDE
     * its range needs those hands dealt, and without this the generator could
     * only ever deal from the range, leaving every out-of-range-only rule
     * answering nothing at all.
     */
    it('holds every combination in the deck', () => {
        expect(countCombos(fullCombos())).toBe(COMBO_COUNT);
    });

    it('masks the bits past the last real combination', () => {
        // 1,326 is not a multiple of 32, so a naive fill would set six spare
        // high bits and report 1,332 combinations that do not exist.
        expect(countCombos(fullCombos())).not.toBeGreaterThan(COMBO_COUNT);
    });

    it('is the complement of the empty set, and vice versa', () => {
        expect(countCombos(subtractCombos(fullCombos(), emptyCombos()))).toBe(COMBO_COUNT);
        expect(countCombos(subtractCombos(fullCombos(), fullCombos()))).toBe(0);
    });

    it('subtracting a range leaves exactly the hands outside it', () => {
        const aces = parseRangeNotation('AA');
        expect(countCombos(subtractCombos(fullCombos(), aces))).toBe(COMBO_COUNT - countCombos(aces));
    });
});
