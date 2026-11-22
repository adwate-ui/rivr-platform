import { zipEntries, zipText } from './zip.ts';

/** The most a workbook part may come to once unpacked: a sheet of 500 lines is about 100 KB, so this is far past any real one. */
const MOST_PART_BYTES = 2_000_000;
/**
 * The most rows a sheet is read to, counted as they come as well as by number, so rows that all claim row 1 stop too; a row
 * past it makes the file too big. The most shared strings, as many again. And the columns read: any past them are left out.
 */
export const MOST_SHEET_ROWS = 5_000;
const MOST_SHARED_STRINGS = 20_000;
const MOST_COLUMNS = 64;
/** The most of a cell read: past any field a sheet of lines holds, so a cell built huge costs no more than this. */
const MOST_CELL_CHARACTERS = 1_000;

/** A cell's text as read: at most the most read, without the spaces around it. */
const cellOf = (text: string) => text.slice(0, MOST_CELL_CHARACTERS).trim();

/** An XML part, or null when it does not parse, or declares a DOCTYPE, which no workbook part has and only a crafted one would. */
function parsed(text: string | null): Document | null {
  if (text === null || /<!DOCTYPE/i.test(text)) return null;
  const document = new DOMParser().parseFromString(text, 'application/xml');
  return document.getElementsByTagName('parsererror').length > 0 ? null : document;
}

/**
 * An element's children of a name, whatever prefix the part gives its namespace. Children only, never deeper: a part nesting
 * rows in rows or strings in strings costs no more to read than one that does not.
 */
function childrenNamed(parent: Element | null | undefined, name: string): Element[] {
  return parent ? Array.from(parent.children).filter((child) => child.localName === name) : [];
}

/** The text of a string (si, or a cell's is): its own t, or its runs' t, in order; never a reading guide (rPh). */
function textOf(element: Element): string {
  return Array.from(element.children).map((child) => {
    if (child.localName === 't') return child.textContent ?? '';
    return child.localName === 'r' ? childrenNamed(child, 't').map((part) => part.textContent ?? '').join('') : '';
  }).join('');
}

/** Where the workbook's first sheet is, by its relationship; the usual place when the workbook does not say. */
function firstSheetPath(workbook: Document | null, relations: Document | null): string {
  const sheets = childrenNamed(workbook?.documentElement, 'sheets')[0];
  const id = childrenNamed(sheets, 'sheet')[0]?.getAttribute('r:id');
  const target = childrenNamed(relations?.documentElement, 'Relationship').find((one) => one.getAttribute('Id') === id)?.getAttribute('Target');
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
  if (type === 'inlineStr') return childrenNamed(cell, 'is').map(textOf).join('');
  const value = childrenNamed(cell, 'v')[0]?.textContent ?? '';
  return type === 's' ? shared[Number(value)] ?? '' : value;
}

/** A row's cells as text, each in its column, an empty cell empty. */
function rowCells(row: Element, shared: readonly string[]): string[] {
  const cells: string[] = [];
  let next = 0;
  for (const cell of childrenNamed(row, 'c')) {
    const column = columnOf(cell.getAttribute('r'), next);
    if (column < MOST_COLUMNS) cells[column] = cellOf(cellText(cell, shared));
    next = column + 1;
  }
  return Array.from(cells, (cell) => cell ?? '');
}

/** A sheet's rows, the nth its row n, a row it skips empty; null when a row is past the most read. */
function sheetRows(sheet: Document, shared: readonly string[]): string[][] | null {
  const data = childrenNamed(sheet.documentElement, 'sheetData')[0];
  if (data === undefined) return [];
  if (data.childElementCount > MOST_SHEET_ROWS) return null;
  const rows: string[][] = [];
  for (const row of childrenNamed(data, 'row')) {
    const number = Number(row.getAttribute('r') ?? rows.length + 1);
    if (!Number.isInteger(number) || number < 1 || number > MOST_SHEET_ROWS) return null;
    rows[number - 1] = rowCells(row, shared);
  }
  return Array.from(rows, (row) => row ?? []);
}

/** The workbook's shared strings: none when it has none; null when it has them but they cannot be read; 'tooBig' past the most. */
async function sharedStrings(read: (name: string) => Promise<string | null>, isThere: boolean): Promise<string[] | null | 'tooBig'> {
  if (!isThere) return [];
  const root = parsed(await read('xl/sharedStrings.xml'))?.documentElement;
  if (root === undefined) return null;
  // Each string made a cell's text once, here, however many cells use it.
  return root.childElementCount > MOST_SHARED_STRINGS ? 'tooBig' : childrenNamed(root, 'si').map((item) => cellOf(textOf(item)));
}

/**
 * A workbook's first sheet as rows of text (an .xlsx, as Excel, Google Sheets or Numbers save it). 'tooBig' for a sheet past
 * the most rows or strings; 'unreadable' for bytes that are no workbook, a part that would unpack past the most bytes among
 * them, so a sheet never reads as empty for strings that could not be read.
 */
export async function xlsxRows(bytes: Uint8Array): Promise<string[][] | 'unreadable' | 'tooBig'> {
  const entries = zipEntries(bytes);
  if (entries === null) return 'unreadable';
  const read = (name: string) => zipText(bytes, entries, name, MOST_PART_BYTES);
  const path = firstSheetPath(parsed(await read('xl/workbook.xml')), parsed(await read('xl/_rels/workbook.xml.rels')));
  const sheet = parsed(await read(path));
  if (sheet === null) return 'unreadable';
  const shared = await sharedStrings(read, entries.has('xl/sharedStrings.xml'));
  if (shared === null) return 'unreadable';
  if (shared === 'tooBig') return shared;
  return sheetRows(sheet, shared) ?? 'tooBig';
}
