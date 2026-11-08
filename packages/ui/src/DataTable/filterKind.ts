import type { ColumnFilterKind, DataTableColumn } from './columns.ts';
import { textOf } from './DataTableExport.tsx';
import { paiseOf, wordsOf, type FilteredColumn } from './filters.ts';

// The rows looked at to tell a column's kind: enough to see its values, few enough for thousands of rows.
const SAMPLE = 200;
// At most this many values, one at least on two rows, make a list to choose from rather than words to type.
const MOST_CHOICES = 12;
const STARTS_WITH_DAY = /^\d{4}-\d{2}-\d{2}/;

const digitsOf = (words: string): string => words.replace(/[^0-9]/g, '');

/**
 * Whether the cells show the figures they sort by (`1,250` for 1250): one at least, and none other words. A cell with no
 * words, such as a status's dot sorted by its rank, tells nothing, so a column of them is never a number.
 */
function showsFigures<Row>(column: DataTableColumn<Row>, sample: readonly Row[]): boolean {
  if (column.sortValue === undefined) return false;
  const shown = sample.map((row) => ({ value: column.sortValue?.(row), words: textOf(column.cell(row)).trim() })).filter(({ words }) => words !== '');
  return shown.length > 0 && shown.every(({ value, words }) => (typeof value === 'number' || typeof value === 'bigint') && digitsOf(words) === digitsOf(String(value)));
}

/** Whether a column sorts by moments or days: each sort value given starts with a day, `YYYY-MM-DD`. */
function sortsByDay<Row>(column: DataTableColumn<Row>, sample: readonly Row[]): boolean {
  const values = sample.map((row) => column.sortValue?.(row)).filter((value) => value !== undefined && value !== '');
  return values.length > 0 && values.every((value) => typeof value === 'string' && STARTS_WITH_DAY.test(value));
}

/** Words to type, or values to choose: a row with several values, or few values that repeat. */
function wordKind<Row>(column: DataTableColumn<Row>, sample: readonly Row[]): 'text' | 'choice' {
  if (sample.some((row) => Array.isArray(column.filterValue?.(row)))) return 'choice';
  const words = sample.flatMap((row) => wordsOf(column, row)).filter((word) => word !== '');
  const distinct = new Set(words).size;
  return distinct <= MOST_CHOICES && words.length > distinct ? 'choice' : 'text';
}

/**
 * The kind of filter a column takes (owner, 9 Nov: every column filtered by its type): none for a column without a
 * heading or one that says `false`; the kind it says; else what its rows show. A Money cell, or a figure shown as it
 * sorts, is a number; a sort by moments or days, a date; else words, to type or to choose from.
 */
export function filterKindOf<Row>(column: DataTableColumn<Row>, rows: readonly Row[]): ColumnFilterKind | null {
  if (column.filter === false || column.header.trim() === '') return null;
  if (column.filter !== undefined) return column.filter;
  const sample = rows.slice(0, SAMPLE);
  if (sample.length === 0) return 'text';
  if (sample.some((row) => paiseOf(column.cell(row)) !== undefined)) return 'number';
  if (showsFigures(column, sample)) return 'number';
  if (sortsByDay(column, sample)) return 'date';
  return wordKind(column, sample);
}

/** Every column with a filter, and its kind, in the table's order. */
export function filteredColumns<Row>(columns: readonly DataTableColumn<Row>[], rows: readonly Row[]): readonly FilteredColumn<Row>[] {
  return columns.flatMap((column) => {
    const kind = filterKindOf(column, rows);
    return kind === null ? [] : [{ column, kind }];
  });
}
