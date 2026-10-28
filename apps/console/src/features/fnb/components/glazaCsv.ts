import type { GlazaKind, GlazaLine } from '@rivr/db/glaza';
import { parseRupees } from '@rivr/domain/money';

/** Glaza's columns, in order, as its file's first line names them (question #580). */
export const GLAZA_COLUMNS = ['time', 'table', 'seat', 'item', 'kind', 'quantity', 'unit_cost', 'unit_price', 'comp'] as const;

const KINDS: Readonly<Record<string, GlazaKind>> = { food: 'food', soft_drink: 'soft_drink', alcohol: 'alcohol' };
const COMPS: Readonly<Record<string, boolean>> = { yes: true, no: false };
// An IST time as Glaza writes it: 2026-11-14 21:30.
const IST_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/;
const WHOLE = /^\d{1,4}$/;

/** A CSV line's fields: commas part them, and a field in double quotes may hold a comma, with "" for a quote. */
export function csvFields(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let isQuoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (char === '"' && isQuoted && line.charAt(index + 1) === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      isQuoted = !isQuoted;
    } else if (char === ',' && !isQuoted) {
      fields.push(field.trim());
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

/** A line's seat, quantity and amounts, or null when one does not read. */
function figuresOf(seat: string, quantity: string, unitCost: string, unitPrice: string) {
  const cost = parseRupees(unitCost);
  const price = parseRupees(unitPrice);
  if (!cost.ok || !price.ok || !WHOLE.test(quantity) || Number(quantity) === 0) return null;
  if (seat !== '' && !WHOLE.test(seat)) return null;
  return { seat: seat === '' ? null : Number(seat), quantity: Number(quantity), unitCost: cost.value, unitPrice: price.value };
}

/** One line as Glaza's file gives it, or null when a field is missing or does not read. */
function lineOf(fields: readonly string[]): GlazaLine | null {
  const field = (index: number) => fields[index] ?? '';
  const at = IST_TIME.exec(field(0));
  const kind = KINDS[field(4).toLowerCase()];
  const isComp = COMPS[field(8).toLowerCase()];
  const figures = figuresOf(field(2), field(5), field(6), field(7));
  if (at === null || kind === undefined || isComp === undefined || figures === null) return null;
  if (field(1) === '' || field(3) === '') return null;
  return { soldAt: `${at[1] ?? ''}T${at[2] ?? ''}:00+05:30`, tableName: field(1), item: field(3), kind, isComp, ...figures };
}

/** Glaza's file as read: its lines, or the numbers of the lines that do not read (line 1 when its columns are not Glaza's). */
export type GlazaFile = { readonly ok: true; readonly lines: readonly GlazaLine[] } | { readonly ok: false; readonly badLines: readonly number[] };

/** Reads Glaza's CSV (#109): its first line names the columns, then one line for each item sold or comped; blank lines are skipped. */
export function readGlazaCsv(text: string): GlazaFile {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((row, index) => ({ number: index + 1, row })).filter(({ row }) => row.trim() !== '');
  const [heading, ...body] = rows;
  if (heading === undefined || csvFields(heading.row).map((name) => name.toLowerCase()).join() !== GLAZA_COLUMNS.join()) return { ok: false, badLines: [1] };
  const read = body.map(({ number, row }) => ({ number, line: lineOf(csvFields(row)) }));
  const badLines = read.filter(({ line }) => line === null).map(({ number }) => number);
  if (badLines.length > 0 || read.length === 0) return { ok: false, badLines };
  return { ok: true, lines: read.flatMap(({ line }) => (line === null ? [] : [line])) };
}
