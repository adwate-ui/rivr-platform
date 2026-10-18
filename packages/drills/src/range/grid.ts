/**
 * The 13x13 grid, and how it maps onto a range.
 *
 * The grid is the shape every poker player already thinks in: pairs down the
 * diagonal, suited above it, offsuit below. Everything here is the pure part —
 * which cell is where, what each contains, and how a set of selected cells
 * becomes notation and back.
 *
 * **Round-tripping losslessly is the requirement that shapes it.** A grid that
 * cannot reproduce the notation it was opened with silently rewrites the
 * author's range the first time it is touched, and every drill generated from
 * that principle afterwards asks about a range nobody wrote.
 */

import { RANKS, RANK_VALUE, type RankCode } from '../cards/cards.ts';
import {
    cellCombos, comboLabel, comboCards, countCombos, emptyCombos, hasCombo,
    unionCombos, COMBO_COUNT, type ComboSet,
} from './comboSet.ts';

export type CellForm = 'pair' | 'suited' | 'offsuit';

export interface GridCell {
    /** `AA`, `AKs`, `AKo`. */
    readonly label: string;
    readonly high: RankCode;
    readonly low: RankCode;
    readonly form: CellForm;
    readonly row: number;
    readonly column: number;
    /** 6 for a pair, 4 suited, 12 offsuit. */
    readonly combos: number;
}

const COMBO_COUNTS: Readonly<Record<CellForm, number>> = { pair: 6, suited: 4, offsuit: 12 };

/**
 * All 169 cells, row-major from the ace corner.
 *
 * Built once. Row above column is suited, below is offsuit, on it is a pair —
 * the arrangement every range chart in print uses, so a reader can find a hand
 * without being taught the layout.
 */
export const GRID_CELLS: readonly GridCell[] = RANKS.flatMap((rowRank, row) =>
    RANKS.map((columnRank, column) => {
        const form: CellForm = row === column ? 'pair' : row < column ? 'suited' : 'offsuit';
        const [high, low] = form === 'offsuit' ? [columnRank, rowRank] : [rowRank, columnRank];
        return {
            label: form === 'pair' ? `${high}${low}` : `${high}${low}${form === 'suited' ? 's' : 'o'}`,
            high,
            low,
            form,
            row,
            column,
            combos: COMBO_COUNTS[form],
        };
    }),
);

const BY_LABEL = new Map(GRID_CELLS.map((cell) => [cell.label, cell]));

/** The cell with this label, such as `AKs`. */
export function cellByLabel(label: string): GridCell | undefined {
    return BY_LABEL.get(label);
}

/** The combinations one cell stands for. */
export function combosForCell(cell: GridCell): ComboSet {
    return cellCombos(cell.high, cell.low, cell.form);
}

/**
 * Which cells a range covers.
 *
 * A cell counts as selected only when EVERY one of its combinations is in the
 * range. A range holding three of the four `AKs` combinations is not "AKs" —
 * the grid cannot draw it, and pretending otherwise is how a round trip loses
 * data. See `partialCells`.
 */
export function selectedCells(combos: ComboSet): Set<string> {
    const selected = new Set<string>();

    for (const cell of GRID_CELLS) {
        const cellSet = combosForCell(cell);
        let all = true;
        for (let index = 0; index < COMBO_COUNT && all; index += 1) {
            if (hasCombo(cellSet, index) && !hasCombo(combos, index)) all = false;
        }
        if (all) selected.add(cell.label);
    }

    return selected;
}

/**
 * Cells the range covers only partly.
 *
 * The grid works in whole cells, so these cannot be drawn faithfully. Reporting
 * them lets the editor warn rather than silently round them up or down — the
 * one thing it must not do.
 */
export function partialCells(combos: ComboSet): string[] {
    const partial: string[] = [];

    for (const cell of GRID_CELLS) {
        const cellSet = combosForCell(cell);
        let present = 0;
        let total = 0;
        for (let index = 0; index < COMBO_COUNT; index += 1) {
            if (!hasCombo(cellSet, index)) continue;
            total += 1;
            if (hasCombo(combos, index)) present += 1;
        }
        if (present > 0 && present < total) partial.push(cell.label);
    }

    return partial;
}

/** The combinations a set of selected cells stands for. */
export function combosForCells(labels: Iterable<string>): ComboSet {
    let combos = emptyCombos();
    for (const label of labels) {
        const cell = BY_LABEL.get(label);
        if (cell !== undefined) combos = unionCombos(combos, combosForCell(cell));
    }
    return combos;
}

/** How many combinations a set of selected cells holds. */
export function countSelected(labels: Iterable<string>): number {
    return countCombos(combosForCells(labels));
}

/** Selected cells as the shortest sensible notation, for `range_set.hands`. */
export function cellsToNotation(labels: Iterable<string>): string[] {
    const set = new Set(labels);
    return GRID_CELLS.filter((cell) => set.has(cell.label)).map((cell) => cell.label);
}

/**
 * Every cell in the rectangle between two, for click-and-drag.
 *
 * A rectangle rather than a path: dragging across a grid selects a block in
 * every spreadsheet anybody has used, and doing something else here would be
 * novel in the bad way.
 */
export function cellsInRectangle(from: GridCell, to: GridCell): GridCell[] {
    const rowLow = Math.min(from.row, to.row);
    const rowHigh = Math.max(from.row, to.row);
    const columnLow = Math.min(from.column, to.column);
    const columnHigh = Math.max(from.column, to.column);

    return GRID_CELLS.filter((cell) =>
        cell.row >= rowLow && cell.row <= rowHigh
        && cell.column >= columnLow && cell.column <= columnHigh);
}

/** Percentage of all 1,326 combinations. The number a reader actually feels. */
export function percentOfHands(combos: ComboSet): number {
    return (countCombos(combos) / COMBO_COUNT) * 100;
}

/** The cell a specific combination belongs to. */
export function cellForCombo(index: number): GridCell | undefined {
    const [a, b] = comboCards(index);
    return BY_LABEL.get(comboLabel(a, b));
}

/** Sorts labels the way the grid reads: strongest first. */
export function sortLabels(labels: Iterable<string>): string[] {
    return [...labels].sort((a, b) => {
        const cellA = BY_LABEL.get(a);
        const cellB = BY_LABEL.get(b);
        if (cellA === undefined || cellB === undefined) return a < b ? -1 : 1;
        return RANK_VALUE[cellB.high] - RANK_VALUE[cellA.high]
            || RANK_VALUE[cellB.low] - RANK_VALUE[cellA.low]
            || cellA.form.localeCompare(cellB.form);
    });
}
