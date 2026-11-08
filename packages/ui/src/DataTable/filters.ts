import { formatDate, formatRupeesForFile, t } from '@rivr/i18n';
import { isValidElement, type ReactNode } from 'react';
import type { ColumnFilterKind, DataTableColumn } from './columns.ts';
import { textOf } from './DataTableExport.tsx';

/** A date filter's ready-made days, counted back from today. */
export type DatePreset = 'today' | 'last7' | 'last30' | 'thisMonth';
export const DATE_PRESETS: readonly DatePreset[] = ['today', 'last7', 'last30', 'thisMonth'];

/**
 * One column's filter in force (owner, 9 Nov: every column filtered by its type): words it contains, values chosen, a
 * figure from and to as typed, a preset of days, or days from and to (`YYYY-MM-DD`, either left blank).
 */
export type ColumnFilter =
  | { readonly kind: 'text'; readonly typed: string }
  | { readonly kind: 'choice'; readonly chosen: readonly string[] }
  | { readonly kind: 'range'; readonly min: string; readonly max: string }
  | { readonly kind: 'date'; readonly preset: DatePreset }
  | { readonly kind: 'dateRange'; readonly from: string; readonly to: string };

/** Each filtered column's filter, by the column's key. */
export type ColumnFilters = Readonly<Record<string, ColumnFilter>>;

export const NO_FILTERS: ColumnFilters = {};

/** A column and the kind of filter it takes. */
export interface FilteredColumn<Row> {
  readonly column: DataTableColumn<Row>;
  readonly kind: ColumnFilterKind;
}

/** Today, and how a moment's day is found: the club's day on the console, else India's calendar day. */
export interface FilterClock {
  readonly today: string;
  readonly dayOf: (at: Date) => string;
}

const INDIA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const COLLATOR = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });

/** India's calendar day of a moment, `YYYY-MM-DD`: a date filter's days where no club day is given. */
export const indiaDayOf = (at: Date): string => INDIA_DAY.format(at);

/** Whether words are a day, `YYYY-MM-DD`. */
export const isDay = (words: string): boolean => DAY.test(words);

/** A day so many days on (or back, below 0). */
export function shiftDay(day: string, days: number): string {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** A Money cell's paise; anything else, none. */
export function paiseOf(node: ReactNode): bigint | undefined {
  return isValidElement<{ paise?: unknown }>(node) && typeof node.props.paise === 'bigint' ? node.props.paise : undefined;
}

/** A row's words as a text or choice filter reads them: its filter values, else its cell's words, else its export's. */
export function wordsOf<Row>(column: DataTableColumn<Row>, row: Row): readonly string[] {
  const own = column.filterValue?.(row);
  if (own !== undefined) return typeof own === 'string' ? [own] : own;
  const shown = textOf(column.cell(row));
  const exported = shown === '' ? column.exportValue?.(row) : undefined;
  return [typeof exported === 'string' ? exported : shown];
}

/** A row's figure as a range reads it: a Money cell's rupees, a duration's hours, else the figure it sorts by. */
export function figureOf<Row>({ column, kind }: FilteredColumn<Row>, row: Row): number | null {
  const paise = paiseOf(column.cell(row));
  if (paise !== undefined) return Number(formatRupeesForFile(paise));
  const value = column.sortValue?.(row);
  if (typeof value !== 'number' && typeof value !== 'bigint') return null;
  return kind === 'duration' ? Number(value) / 3600 : Number(value);
}

/** A row's day as a date filter reads it, from what it sorts by: a day as it is, or a moment's day. */
export function dayOfRow<Row>(column: DataTableColumn<Row>, row: Row, dayOf: (at: Date) => string): string | null {
  const value = column.sortValue?.(row);
  if (value === undefined || value === '') return null;
  if (typeof value === 'string' && isDay(value)) return value;
  const at = new Date(typeof value === 'bigint' ? Number(value) : value);
  return Number.isNaN(at.getTime()) ? null : dayOf(at);
}

/** A typed bound: a figure, commas, spaces and units aside; blank or not a figure, no bound. */
export function boundOf(typed: string): number | null {
  const figure = typed.replace(/[,\s₹h]/g, '');
  if (figure === '') return null;
  const value = Number(figure);
  return Number.isFinite(value) ? value : null;
}

/** Whether a filter asks anything: words typed, a value chosen, a bound, a preset, or a day. */
export function isOn(filter: ColumnFilter | undefined): filter is ColumnFilter {
  switch (filter?.kind) {
    case undefined: return false;
    case 'text': return filter.typed.trim() !== '';
    case 'choice': return filter.chosen.length > 0;
    case 'range': return boundOf(filter.min) !== null || boundOf(filter.max) !== null;
    case 'date': return true;
    case 'dateRange': return filter.from !== '' || filter.to !== '';
  }
}

// Which filters each kind of column holds: words and values read the same words, so either fits either.
const FITS: Readonly<Record<ColumnFilterKind, readonly ColumnFilter['kind'][]>> = {
  text: ['text', 'choice'], choice: ['text', 'choice'], number: ['range'], duration: ['range'], date: ['date', 'dateRange'],
};

/** The columns with a filter in force that fits them, in the table's order. */
export function filtersOn<Row>(filtered: readonly FilteredColumn<Row>[], filters: ColumnFilters): readonly FilteredColumn<Row>[] {
  return filtered.filter(({ column, kind }) => {
    const filter = filters[column.key];
    return isOn(filter) && FITS[kind].includes(filter.kind);
  });
}

const inDays = (day: string | null, from: string, to: string): boolean => day !== null && (from === '' || day >= from) && (to === '' || day <= to);

/** The days a preset holds, today's last. */
export function presetDays(preset: DatePreset, today: string): { readonly from: string; readonly to: string } {
  switch (preset) {
    case 'today': return { from: today, to: today };
    case 'last7': return { from: shiftDay(today, -6), to: today };
    case 'last30': return { from: shiftDay(today, -29), to: today };
    case 'thisMonth': return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

function inRange(value: number | null, min: string, max: string): boolean {
  const low = boundOf(min);
  const high = boundOf(max);
  return value !== null && (low === null || value >= low) && (high === null || value <= high);
}

function holds<Row>(filter: ColumnFilter, on: FilteredColumn<Row>, row: Row, clock: FilterClock): boolean {
  switch (filter.kind) {
    case 'text': return wordsOf(on.column, row).join(' ').toLowerCase().includes(filter.typed.trim().toLowerCase());
    case 'choice': return wordsOf(on.column, row).some((word) => filter.chosen.includes(word));
    case 'range': return inRange(figureOf(on, row), filter.min, filter.max);
    case 'date': {
      const { from, to } = presetDays(filter.preset, clock.today);
      return inDays(dayOfRow(on.column, row, clock.dayOf), from, to);
    }
    case 'dateRange': return inDays(dayOfRow(on.column, row, clock.dayOf), filter.from, filter.to);
  }
}

/** Whether a row holds every filter in force. */
export function passes<Row>(row: Row, on: readonly FilteredColumn<Row>[], filters: ColumnFilters, clock: FilterClock): boolean {
  return on.every((column) => {
    const filter = filters[column.column.key];
    return filter === undefined || holds(filter, column, row, clock);
  });
}

/** A choice column's values among the rows, in order, each with how many rows hold it; a blank value is no choice. */
export function choicesOf<Row>(column: DataTableColumn<Row>, rows: readonly Row[]): readonly { readonly value: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const value of new Set(wordsOf(column, row))) {
      if (value !== '') counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts].sort(([one], [other]) => COLLATOR.compare(one, other)).map(([value, count]) => ({ value, count }));
}

const dayWords = (day: string): string => formatDate(new Date(`${day}T12:00:00+05:30`));

/** From and to in words: both, either, with a unit after a figure (`2 to 4 h`). */
function fromToWords(from: string, to: string, unit: string): string {
  if (from !== '' && to !== '') return t('ui.dataTable.fromTo', { from, to: `${to}${unit}` });
  return from !== '' ? t('ui.dataTable.atLeast', { value: `${from}${unit}` }) : t('ui.dataTable.atMost', { value: `${to}${unit}` });
}

/** What a filter asks, in words, as a pill and an export say it: `ravi`, `Admin or Cashier`, `2 to 4 h`, `Last 7 days`. */
export function filterWords(filter: ColumnFilter, kind: ColumnFilterKind): string {
  switch (filter.kind) {
    case 'text': return filter.typed.trim();
    case 'choice': return filter.chosen.join(t('ui.dataTable.or'));
    case 'range': return fromToWords(filter.min.trim(), filter.max.trim(), kind === 'duration' ? ` ${t('ui.dataTable.hoursUnit')}` : '');
    case 'date': return t(`ui.dataTable.datePresets.${filter.preset}`);
    case 'dateRange': return filter.from !== '' && filter.to !== '' ? t('ui.dataTable.fromTo', { from: dayWords(filter.from), to: dayWords(filter.to) })
      : filter.from !== '' ? t('ui.dataTable.fromDay', { day: dayWords(filter.from) }) : t('ui.dataTable.toDay', { day: dayWords(filter.to) });
  }
}

/** The filters in force in words, as an export records them: `Role: Admin or Cashier`, `Joined: Last 7 days`. */
export function filtersInWords<Row>(on: readonly FilteredColumn<Row>[], filters: ColumnFilters): readonly string[] {
  return on.flatMap(({ column, kind }) => {
    const filter = filters[column.key];
    return filter === undefined ? [] : [t('ui.dataTable.filterInForce', { label: column.header, value: filterWords(filter, kind) })];
  });
}
