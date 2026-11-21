import { zipEntries, zipText } from './zip.ts';

/** The most a workbook part may come to once unpacked: far past any file of a few hundred lines. */
const MOST_PART_BYTES = 20_000_000;
/** The most rows a sheet is read to; a row past it makes the file too big. And the columns read: any past them are left out. */
export const MOST_SHEET_ROWS = 5_000;
const MOST_COLUMNS = 64;

/** An XML part, or null when it does not parse. */
function parsed(text: string | null): Document | null {
  if (text === null) return null;
  const document = new DOMParser().parseFromString(text, 'application/xml');
  return document.getElementsByTagName('parsererror').length > 0 ? null : document;
}

/** The elements of a name, whatever prefix the part gives its namespace. */
function named(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagNameNS('*', name));
}

/** The text of a string, its runs together, without the reading guides some languages add (rPh). */
function textOf(element: Element): string {
  return named(element, 't').filter((part) => part.parentElement?.localName !== 'rPh').map((part) => part.textContent ?? '').join('');
}

/** Where the workbook's first sheet is, by its relationship; the usual place when the workbook does not say. */
function firstSheetPath(workbook: Document | null, relations: Document | null): string {
  const id = workbook === null ? null : named(workbook, 'sheet')[0]?.getAttribute('r:id');
  const target = relations === null ? undefined : named(relations, 'Relationship').find((one) => one.getAttribute('Id') === id)?.getAttribute('Target');
  if (target === undefined || target === null) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

/** A cell's column from its reference (A is 0, AB is 27), or the next one when it has none. */
function columnOf(reference: string | null, next: number): number {
  const letters = /^[A-Z]+/.exec(reference ?? '')?.[0];
  if (letters === undefined) return next;
  return [...letters].reduce((column, letter) => column * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

/** A cell as text: a shared string, an inline one, or its value as written (a number, a formula's result, 1 or 0). */
function cellText(cell: Element, shared: readonly string[]): string {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') return named(cell, 'is').map(textOf).join('');
  const value = named(cell, 'v')[0]?.textContent ?? '';
  return type === 's' ? shared[Number(value)] ?? '' : value;
}

/** A row's cells as text, each in its column, an empty cell empty. */
function rowCells(row: Element, shared: readonly string[]): string[] {
  const cells: string[] = [];
  let next = 0;
  for (const cell of named(row, 'c')) {
    const column = columnOf(cell.getAttribute('r'), next);
    if (column < MOST_COLUMNS) cells[column] = cellText(cell, shared).trim();
    next = column + 1;
  }
  return Array.from(cells, (cell) => cell ?? '');
}

/** A sheet's rows, the nth its row n, a row it skips empty; null when a row is past the most read. */
function sheetRows(sheet: Document, shared: readonly string[]): string[][] | null {
  const rows: string[][] = [];
  for (const row of named(sheet, 'row')) {
    const number = Number(row.getAttribute('r') ?? rows.length + 1);
    if (!Number.isInteger(number) || number < 1 || number > MOST_SHEET_ROWS) return null;
    rows[number - 1] = rowCells(row, shared);
  }
  return Array.from(rows, (row) => row ?? []);
}

/**
 * A workbook's first sheet as rows of text (an .xlsx, as Excel, Google Sheets or Numbers save it). 'unreadable' for bytes that
 * are no workbook, 'tooBig' for a sheet past the most rows or a part past the most bytes.
 */
export async function xlsxRows(bytes: Uint8Array): Promise<string[][] | 'unreadable' | 'tooBig'> {
  const entries = zipEntries(bytes);
  if (entries === null) return 'unreadable';
  const read = (name: string) => zipText(bytes, entries, name, MOST_PART_BYTES);
  const path = firstSheetPath(parsed(await read('xl/workbook.xml')), parsed(await read('xl/_rels/workbook.xml.rels')));
  const sheet = parsed(await read(path));
  if (sheet === null) return 'unreadable';
  const strings = parsed(await read('xl/sharedStrings.xml'));
  const shared = strings === null ? [] : named(strings, 'si').map(textOf);
  return sheetRows(sheet, shared) ?? 'tooBig';
}
