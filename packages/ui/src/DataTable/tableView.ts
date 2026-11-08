import type { DataTableSort } from './columns.ts';
import { DATE_PRESETS, isDay, isOn, NO_FILTERS, type ColumnFilter, type ColumnFilters, type DatePreset } from './filters.ts';

/** What a table shows (owner, 9 Nov: kept in the address): its order, the words searched, and its filters. */
export interface TableView {
  readonly sort: DataTableSort | null;
  readonly query: string;
  readonly filters: ColumnFilters;
}

/**
 * A view as the address keeps it, only what differs from the table's own: `s` the order (`visits`, or `-visits`
 * descending; blank, none), `q` the words searched, `f` each filter by column (`['t', words]`, `['c', ...values]`,
 * `['r', from, to]`, `['p', preset]`, `['d', from, to]`).
 */
export interface ViewWire {
  readonly s?: string;
  readonly q?: string;
  readonly f?: Readonly<Record<string, readonly string[]>>;
}

// A link could carry anything: words are cut at 200 characters, a list at 50 values, filters at 50 columns.
const MOST_CHARS = 200;
const MOST_VALUES = 50;
const MOST_FILTERS = 50;

/** Whether an address's key is a table's view, which a screen keeps as it opens a row (`keepTableViews`). */
export const isViewKey = (key: string): boolean => key.startsWith('t.');

/** The address's key for a table, from its name: `t.members` for Members. */
export function viewKey(label: string): string {
  return `t.${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

const sortWire = (sort: DataTableSort | null): string => (sort === null ? '' : `${sort.direction === 'descending' ? '-' : ''}${sort.key}`);

function filterWire(filter: ColumnFilter): readonly string[] {
  switch (filter.kind) {
    case 'text': return ['t', filter.typed];
    case 'choice': return ['c', ...filter.chosen];
    case 'range': return ['r', filter.min, filter.max];
    case 'date': return ['p', filter.preset];
    case 'dateRange': return ['d', filter.from, filter.to];
  }
}

/** A view as the address keeps it; nothing when it is the table's own. */
export function toWire(view: TableView, initialSort: DataTableSort | null): ViewWire | undefined {
  const on = Object.entries(view.filters).filter(([, filter]) => isOn(filter));
  const order = sortWire(view.sort);
  const wire: ViewWire = {
    ...(order === sortWire(initialSort) ? {} : { s: order }),
    ...(view.query.trim() === '' ? {} : { q: view.query }),
    ...(on.length === 0 ? {} : { f: Object.fromEntries(on.map(([key, filter]) => [key, filterWire(filter)])) }),
  };
  return Object.keys(wire).length === 0 ? undefined : wire;
}

/** A list of words cut to size, or nothing if it is not one. */
function wordsIn(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const parts: readonly unknown[] = value;
  return parts.every((part) => typeof part === 'string') ? parts.map((part) => String(part).slice(0, MOST_CHARS)) : null;
}

const isPreset = (words: string | undefined): words is DatePreset => DATE_PRESETS.some((preset) => preset === words);
const dayOrBlank = (words: string | undefined): string => (words !== undefined && isDay(words) ? words : '');

// Each filter's code and how its words read back; a Map, so a link's `toString` is no code.
const DECODERS = new Map<string, (rest: readonly string[]) => ColumnFilter | null>([
  ['t', (rest) => ({ kind: 'text', typed: rest[0] ?? '' })],
  ['c', (rest) => ({ kind: 'choice', chosen: rest.slice(0, MOST_VALUES) })],
  ['r', (rest) => ({ kind: 'range', min: rest[0] ?? '', max: rest[1] ?? '' })],
  ['p', (rest) => (isPreset(rest[0]) ? { kind: 'date', preset: rest[0] } : null)],
  ['d', (rest) => ({ kind: 'dateRange', from: dayOrBlank(rest[0]), to: dayOrBlank(rest[1]) })],
]);

function filterFrom(value: unknown): ColumnFilter | null {
  const [code, ...rest] = wordsIn(value) ?? [];
  const decode = code === undefined ? undefined : DECODERS.get(code);
  return decode === undefined ? null : decode(rest);
}

function sortFrom(value: unknown, initialSort: DataTableSort | null): DataTableSort | null {
  if (typeof value !== 'string') return initialSort;
  const order = value.slice(0, MOST_CHARS);
  if (order === '' || order === '-') return null;
  return order.startsWith('-') ? { key: order.slice(1), direction: 'descending' } : { key: order, direction: 'ascending' };
}

function filtersFrom(value: unknown): ColumnFilters {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return NO_FILTERS;
  const entries = Object.keys(value).slice(0, MOST_FILTERS).flatMap((key) => {
    const filter = filterFrom(Reflect.get(value, key));
    return filter === null ? [] : [[key, filter] as const];
  });
  return Object.fromEntries(entries);
}

/** A view from the address: what it does not say, or says wrongly, is the table's own. */
export function fromWire(wire: unknown, initialSort: DataTableSort | null): TableView {
  if (typeof wire !== 'object' || wire === null || Array.isArray(wire)) return { sort: initialSort, query: '', filters: NO_FILTERS };
  const query: unknown = Reflect.get(wire, 'q');
  return {
    sort: sortFrom(Reflect.get(wire, 's'), initialSort),
    query: typeof query === 'string' ? query.slice(0, MOST_CHARS) : '',
    filters: filtersFrom(Reflect.get(wire, 'f')),
  };
}
