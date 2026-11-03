import type { FnbItemKind } from '@rivr/contracts';
import type { FnbMenuFileItem } from '@rivr/db/fnb';
import { csvFields } from './glazaCsv.ts';

/**
 * One line of the file: its item, or what is wrong with it: no name or one over 60 characters, a type the menu has not,
 * on offer not yes, no or blank, or a name listed above (in any case: the menu holds each name once).
 */
export type MenuCsvLine =
  | { readonly line: number; readonly ok: true; readonly item: FnbMenuFileItem }
  | { readonly line: number; readonly ok: false; readonly problem: 'name' | 'type' | 'onOffer' }
  | { readonly line: number; readonly ok: false; readonly problem: 'twice'; readonly name: string };

/** A menu file as read: each line with its item or what is wrong, or what is wrong with the whole file. */
export interface MenuCsv {
  readonly lines: readonly MenuCsvLine[];
  readonly fileProblem: 'columns' | 'empty' | 'tooMany' | null;
}

// As save_fnb_menu allows.
const MOST_ITEMS = 300;

// The kinds as the console and the app name them, and as the database does. Maps, so a word such as `constructor` is no kind.
const KINDS = new Map<string, FnbItemKind>([
  ['food', 'food'], ['soft drink', 'soft_drink'], ['soft drinks', 'soft_drink'], ['alcohol', 'alcohol'], ['bar', 'alcohol'],
]);
// Blank, or no such column, leaves an item the menu has as it is, and puts a new one on offer.
const ON_OFFER = new Map<string, boolean | null>([['', null], ['yes', true], ['no', false]]);

/** A heading or a value as compared: lower case, with spaces and underscores as one space. */
const plain = (text: string) => text.toLowerCase().replace(/[\s_]+/g, ' ').trim();

/** Where each column is, by its heading: the name and type (item and kind, as Glaza's files say) are needed, on offer is not, and any other (a price) is left out. */
function columnsOf(heading: readonly string[]) {
  const at = (...names: string[]) => heading.findIndex((cell) => names.includes(plain(cell)));
  const columns = { name: at('name', 'item'), type: at('type', 'kind'), onOffer: at('on offer', 'available') };
  return columns.name < 0 || columns.type < 0 ? null : columns;
}

/** One line's item, or what is wrong with it. */
function lineOf(fields: readonly string[], columns: NonNullable<ReturnType<typeof columnsOf>>, line: number): MenuCsvLine {
  const name = fields[columns.name] ?? '';
  const kind = KINDS.get(plain(fields[columns.type] ?? ''));
  const isAvailable = ON_OFFER.get(plain(fields[columns.onOffer] ?? ''));
  if (name === '' || name.length > 60) return { line, ok: false, problem: 'name' };
  if (kind === undefined) return { line, ok: false, problem: 'type' };
  if (isAvailable === undefined) return { line, ok: false, problem: 'onOffer' };
  return { line, ok: true, item: { name, kind, isAvailable } };
}

/** The same line with a name listed above it marked as such: the menu holds each name once. */
function markTwice(lines: readonly MenuCsvLine[]): MenuCsvLine[] {
  const seen = new Set<string>();
  return lines.map((read) => {
    if (!read.ok) return read;
    const key = read.item.name.toLowerCase();
    if (seen.has(key)) return { line: read.line, ok: false, problem: 'twice', name: read.item.name };
    seen.add(key);
    return read;
  });
}

/**
 * Reads a menu file (#799): a first line naming the columns (name and type, and on offer if wanted), then an item a line.
 * Blank lines, and a spreadsheet's lines of commas alone, are skipped; a price column is left out, as the menu keeps none.
 * On offer left blank, or no such column, leaves an item the menu has as it is (`isAvailable` null).
 */
export function readMenuCsv(text: string): MenuCsv {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((row, index) => ({ line: index + 1, fields: csvFields(row) }))
    .filter(({ fields }) => fields.some((field) => field !== ''));
  const [heading, ...body] = rows;
  if (heading === undefined) return { lines: [], fileProblem: 'empty' };
  const columns = columnsOf(heading.fields);
  if (columns === null) return { lines: [], fileProblem: 'columns' };
  if (body.length === 0) return { lines: [], fileProblem: 'empty' };
  if (body.length > MOST_ITEMS) return { lines: [], fileProblem: 'tooMany' };
  return { lines: markTwice(body.map(({ line, fields }) => lineOf(fields, columns, line))), fileProblem: null };
}

/** The items to save, or null while the file or any line is wrong: nothing is saved until all of it reads. */
export function menuItemsToSave(csv: MenuCsv): FnbMenuFileItem[] | null {
  if (csv.fileProblem !== null) return null;
  const items = csv.lines.flatMap((read) => (read.ok ? [read.item] : []));
  return items.length === csv.lines.length ? items : null;
}
