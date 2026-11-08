import type { ReactNode } from 'react';

// The table's column and sort, apart from DataTable.tsx so that its rows (rows.tsx) can read them without a cycle.

/** The kinds of filter a column takes. */
export type ColumnFilterKind = 'text' | 'choice' | 'number' | 'duration' | 'date';

/** One column: its header, what each row shows in it, and the value it sorts by (no sorting without one). */
export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: string;
  readonly cell: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => string | number | bigint;
  /** Figures and money line up at the end. */
  readonly align?: 'start' | 'end';
  /**
   * How a phone shows the column, where each row is a card (#603): `primary`, the card's title (the first column by
   * default); `secondary`, a line under it with the column's name; `optional`, left out below 768 px.
   */
  readonly priority?: 'primary' | 'secondary' | 'optional';
  /** Twice a column's share of the width from 768 px, for words that would wrap in one share: a stake's name. */
  readonly isWide?: boolean;
  /**
   * What an export gives for the column (#102). Without one: the cell's words, a Money cell's rupees, or the
   * sort value. A column with no heading, such as a row's buttons, is left out of exports.
   */
  readonly exportValue?: (row: Row) => string | number;
  /**
   * The column's filter, opened from its header (owner, 9 Nov: every column filtered by its type): `text`, words it
   * contains; `choice`, any of the values its rows hold; `number`, a figure from and to; `duration`, hours from and to, of
   * a sort value in seconds; `date`, a day from a preset or from and to, of a sort value that is a moment. Left out, the
   * rows say which (`filterKindOf`); `false`, none. Every filter in force must hold.
   */
  readonly filter?: ColumnFilterKind | false;
  /** What the filter reads: one value, or several (a player at two tables) any of which a choice may hold; without it, the cell's words. */
  readonly filterValue?: (row: Row) => string | readonly string[];
}

/**
 * A column only an export carries, after the table's own (the owner, 9 Nov: a Members export with every member field):
 * its heading and each row's value, never drawn in the table.
 */
export interface DataTableExportColumn<Row> {
  readonly key: string;
  readonly header: string;
  readonly exportValue: (row: Row) => string | number;
}

/** Which column the rows are sorted by, and which way. */
export interface DataTableSort {
  readonly key: string;
  readonly direction: 'ascending' | 'descending';
}
