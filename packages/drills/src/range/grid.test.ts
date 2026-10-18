import { describe, it, expect } from 'vitest';
import { cardOrThrow as card } from '../cards/cards.ts';
import { COMBO_COUNT, countCombos, equalCombos, emptyCombos, addCombo, comboIndex } from './comboSet.ts';
import { parseHands, parseRangeNotation } from './parse.ts';
import {
    GRID_CELLS, cellByLabel, combosForCell, combosForCells, selectedCells, partialCells,
    countSelected, cellsToNotation, cellsInRectangle, percentOfHands, cellForCombo, sortLabels,
    type GridCell,
} from './grid.ts';

/**
 * The 13x13 grid.
 *
 * The round-trip tests are the ones that matter. An editor that cannot
 * reproduce the notation it opened with silently rewrites the author's range
 * the first time somebody clicks a cell — and every drill generated from that
 * principle afterwards asks about a range nobody wrote.
 */


/** A cell the test expects to exist. */
const cell = (label: string): GridCell => {
    const found = cellByLabel(label);
    if (found === undefined) throw new Error(`No cell ${label}`);
    return found;
};

describe('the grid itself', () => {
    it('is 169 cells', () => {
        expect(GRID_CELLS).toHaveLength(169);
        expect(new Set(GRID_CELLS.map((cell) => cell.label)).size).toBe(169);
    });

    it('puts pairs on the diagonal, suited above it, offsuit below', () => {
        expect(cellByLabel('AA')?.form).toBe('pair');
        expect(cellByLabel('AA')?.row).toBe(cellByLabel('AA')?.column);
        expect(cellByLabel('AKs')?.form).toBe('suited');
        expect(cell('AKs').row).toBeLessThan(cell('AKs').column);
        expect(cellByLabel('AKo')?.form).toBe('offsuit');
        expect(cell('AKo').row).toBeGreaterThan(cell('AKo').column);
    });

    it('always names the higher rank first', () => {
        GRID_CELLS.forEach((cell) => expect(cell.label.startsWith(cell.high)).toBe(true));
    });

    it('counts 6 combinations for a pair, 4 suited, 12 offsuit', () => {
        expect(cellByLabel('AA')?.combos).toBe(6);
        expect(cellByLabel('AKs')?.combos).toBe(4);
        expect(cellByLabel('AKo')?.combos).toBe(12);
    });

    it('agrees with the combination set it stands for', () => {
        GRID_CELLS.forEach((cell) => {
            expect(countCombos(combosForCell(cell))).toBe(cell.combos);
        });
    });

    it('covers the whole deck exactly once between them', () => {
        const all = combosForCells(GRID_CELLS.map((cell) => cell.label));
        expect(countCombos(all)).toBe(COMBO_COUNT);
        expect(GRID_CELLS.reduce((total, cell) => total + cell.combos, 0)).toBe(COMBO_COUNT);
    });

    it('returns nothing for a label that is not a cell', () => {
        expect(cellByLabel('ZZ')).toBeUndefined();
        expect(countSelected(['ZZ'])).toBe(0);
    });
});

describe('reading a range onto the grid', () => {
    it('selects a cell only when every one of its combinations is present', () => {
        expect(selectedCells(parseRangeNotation('AKs')).has('AKs')).toBe(true);
        expect(selectedCells(parseRangeNotation('AA')).has('AKs')).toBe(false);
    });

    it('selects everything a plus form covers', () => {
        const selected = selectedCells(parseRangeNotation('TT+'));
        expect([...selected].sort()).toEqual(['AA', 'JJ', 'KK', 'QQ', 'TT']);
    });

    it('reports a cell the range only partly covers rather than rounding it', () => {
        // One of the four AKs combinations. The grid works in whole cells, so
        // this cannot be drawn — and quietly rounding it either way would lose
        // the author's range.
        const oneCombo = emptyCombos();
        addCombo(oneCombo, comboIndex(card('Ah'), card('Kh')));

        expect(selectedCells(oneCombo).has('AKs')).toBe(false);
        expect(partialCells(oneCombo)).toEqual(['AKs']);
    });

    it('finds no partial cells in a range built from whole cells', () => {
        expect(partialCells(parseHands(['77+', 'AJs+', 'KQo']))).toEqual([]);
    });

    it('names the cell a specific combination belongs to', () => {
        expect(cellForCombo(comboIndex(card('Ah'), card('Kh')))?.label).toBe('AKs');
        expect(cellForCombo(comboIndex(card('Ah'), card('Kd')))?.label).toBe('AKo');
        expect(cellForCombo(comboIndex(card('Ah'), card('Ad')))?.label).toBe('AA');
    });
});

describe('round-tripping', () => {
    it.each([
        ['AA'],
        ['TT+'],
        ['AKs'],
        ['AKo'],
        ['A5s+'],
        ['77-JJ'],
        ['ATs-A7s'],
    ])('reproduces %s exactly', (notation) => {
        const original = parseRangeNotation(notation);
        const labels = selectedCells(original);
        expect(equalCombos(combosForCells(labels), original)).toBe(true);
    });

    it('reproduces a whole authored range', () => {
        const hands = ['22+', 'A2s+', 'K7s+', 'Q9s+', 'J9s+', 'T9s', 'A9o+', 'KTo+', 'QTo+'];
        const original = parseHands(hands);
        const labels = selectedCells(original);

        expect(equalCombos(combosForCells(labels), original)).toBe(true);
        expect(countSelected(labels)).toBe(countCombos(original));
    });

    it('survives a second trip through the grid unchanged', () => {
        const original = parseHands(['77+', 'AJs+']);
        const once = combosForCells(selectedCells(original));
        const twice = combosForCells(selectedCells(once));
        expect(equalCombos(twice, once)).toBe(true);
    });

    it('writes notation the parser accepts back', () => {
        const labels = selectedCells(parseHands(['TT+', 'AKs']));
        const notation = cellsToNotation(labels);
        expect(equalCombos(parseHands(notation), parseHands(['TT+', 'AKs']))).toBe(true);
    });

    it('writes an empty list for an empty range', () => {
        expect(cellsToNotation(selectedCells(combosForCells([])))).toEqual([]);
    });
});

describe('dragging', () => {
    it('takes the rectangle between two cells', () => {
        expect(cellsInRectangle(cell('AA'), cell('AQs')).map((each) => each.label)).toEqual(['AA', 'AKs', 'AQs']);
    });

    it('works whichever corner the drag started from', () => {
        const a = cell('AA');
        const b = cell('QQ');
        expect(cellsInRectangle(a, b)).toEqual(cellsInRectangle(b, a));
    });

    it('takes a single cell when the drag never moved', () => {
        const only = cell('AA');
        expect(cellsInRectangle(only, only)).toEqual([only]);
    });

    it('takes a block, not a path', () => {
        // AA sits at row 0 column 0 and KQs at row 1 column 2, so the block is
        // the whole 2x3 rectangle between them — not the three cells a diagonal
        // drag passes over.
        const block = cellsInRectangle(cell('AA'), cell('KQs'));
        expect(block).toHaveLength(6);
        expect(block.map((each) => each.label).sort())
            .toEqual(['AA', 'AKo', 'AKs', 'AQs', 'KK', 'KQs']);
    });
});

describe('counting', () => {
    it('reports how many combinations are selected', () => {
        expect(countSelected(['AA'])).toBe(6);
        expect(countSelected(['AA', 'AKs'])).toBe(10);
        expect(countSelected([])).toBe(0);
    });

    it('reports the share of all hands', () => {
        expect(percentOfHands(combosForCells([]))).toBe(0);
        expect(percentOfHands(combosForCells(GRID_CELLS.map((cell) => cell.label)))).toBe(100);
        expect(percentOfHands(parseRangeNotation('AA'))).toBeCloseTo((6 / 1326) * 100, 6);
    });
});

describe('ordering labels', () => {
    it('reads strongest first', () => {
        expect(sortLabels(['72o', 'AA', 'KQs', 'AKo'])[0]).toBe('AA');
    });

    it('separates the suited and offsuit form of the same two ranks', () => {
        // Same high card, same low card — only the form can order them.
        expect(sortLabels(['AKs', 'AKo'])).toEqual(['AKo', 'AKs']);
    });

    it('falls back on plain text for a label that is not a cell, rather than throwing', () => {
        expect(sortLabels(['AA', 'ZZ'])).toHaveLength(2);
        expect(sortLabels(['ZZ', 'AA'])).toHaveLength(2);
        expect(sortLabels(['ZZ', 'YY'])).toEqual(['YY', 'ZZ']);
        expect(sortLabels(['YY', 'ZZ'])).toEqual(['YY', 'ZZ']);
    });
});

