import type { FloorTable, VisitFileLine } from '@rivr/db';
import type { BonusFileMember } from '@rivr/db/bonusFile';
import { clubNightSpan } from '@rivr/domain/clubDay';
import { memberKeyOf } from './bonusFile.ts';

/** The most lines a file holds, as private.visits_from_file takes them. */
export const VISIT_FILE_MOST_LINES = 500;

/** What is wrong with a line as read: no member number or mobile, no club night and times, no table, or no reason. */
export type VisitReadProblem = 'member' | 'night' | 'table' | 'reason';

/** One line of the file: whom, the visit's times, the table's name and why; or what is wrong. */
export type VisitReadLine =
  | { readonly line: number; readonly ok: true; readonly key: string; readonly openedAt: Date; readonly closedAt: Date; readonly table: string; readonly reason: string }
  | { readonly line: number; readonly ok: false; readonly problem: VisitReadProblem };

/** A visit file as read: each line, or what is wrong with the whole file. */
export interface VisitReadFile {
  readonly lines: readonly VisitReadLine[];
  readonly fileProblem: 'columns' | 'empty' | 'tooMany' | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// The day an Excel date cell counts from: 30 Dec 1899, so 46346 is 20 Nov 2026.
const EXCEL_DAY_NOUGHT_MS = Date.UTC(1899, 11, 30);

/** A heading or a value as compared: lower case, with spaces and underscores as one space. */
const plain = (text: string) => text.toLowerCase().replace(/[\s_]+/g, ' ').trim();
const pad = (n: number) => String(n).padStart(2, '0');

/** A club night as `2026-11-20`, from `2026-11-20`, `20/11/2026`, `20-11-2026` or an Excel date cell; null for none of these. */
export function nightOf(text: string): string | null {
  const value = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dayFirst !== null) return `${dayFirst[3] ?? ''}-${(dayFirst[2] ?? '').padStart(2, '0')}-${(dayFirst[1] ?? '').padStart(2, '0')}`;
  if (/^\d{5}(\.\d+)?$/.test(value)) return new Date(EXCEL_DAY_NOUGHT_MS + Math.floor(Number(value)) * DAY_MS).toISOString().slice(0, 10);
  return null;
}

/** The hour on a 24-hour clock from one written with am or pm (1 to 12), or as written without; null for no hour. */
function hourOf(hours: number, half: string | undefined): number | null {
  if (half === undefined) return hours <= 23 ? hours : null;
  if (hours < 1 || hours > 12) return null;
  return (hours % 12) + (half === 'pm' ? 12 : 0);
}

/** A time as `20:00`, from `20:00`, `8:00 pm`, `20:00:00` or an Excel time cell (a fraction of a day); null for none of these. */
export function clockOf(text: string): string | null {
  const value = text.trim().toLowerCase();
  if (/^(0|0?\.\d+)$/.test(value)) {
    const minutes = Math.round(Number(value) * 1440) % 1440;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }
  const match = /^(\d{1,2}):([0-5]\d)(?::\d{2})?\s*(am|pm)?$/.exec(value);
  const hour = match === null ? null : hourOf(Number(match[1]), match[3]);
  return match === null || hour === null ? null : `${pad(hour)}:${match[2] ?? ''}`;
}

/** Where each column is, by its heading on the first line; null when one of the six is not there. */
function columnsOf(heading: readonly string[]) {
  const at = (...names: string[]) => heading.findIndex((cell) => names.includes(plain(cell)));
  const columns = {
    member: at('member', 'member number', 'number', 'mobile', 'phone'), night: at('date', 'night', 'club night', 'day'),
    checkIn: at('check-in', 'check in', 'checkin', 'in'), checkOut: at('check-out', 'check out', 'checkout', 'out'),
    table: at('table', 'table name'), reason: at('reason', 'note'),
  };
  return Object.values(columns).some((index) => index < 0) ? null : columns;
}

/** A reason private.assert_visit_to_add takes: 3 to 200 characters, on one line, with no control character. */
const isReason = (reason: string) => reason.length >= 3 && reason.length <= 200 && !/\p{Cc}/u.test(reason);

/** One line's member, times, table and reason, or the first of them that is wrong. */
function lineOf(fields: readonly string[], columns: NonNullable<ReturnType<typeof columnsOf>>, line: number): VisitReadLine {
  const field = (index: number) => fields[index] ?? '';
  const key = memberKeyOf(field(columns.member));
  const night = nightOf(field(columns.night));
  const checkIn = clockOf(field(columns.checkIn));
  const checkOut = clockOf(field(columns.checkOut));
  const span = night === null || checkIn === null || checkOut === null ? null : clubNightSpan(night, checkIn, checkOut);
  const table = field(columns.table).trim();
  const reason = field(columns.reason).trim();
  if (key === null) return { line, ok: false, problem: 'member' };
  if (span === null) return { line, ok: false, problem: 'night' };
  if (table === '') return { line, ok: false, problem: 'table' };
  if (!isReason(reason)) return { line, ok: false, problem: 'reason' };
  return { line, ok: true, key, ...span, table, reason };
}

/** A file's rows (the nth the file's line n) as visits: the first names the columns, and an empty line is passed over. */
export function readVisitFile(rows: readonly (readonly string[])[]): VisitReadFile {
  const [heading, ...body] = rows;
  const columns = heading === undefined ? null : columnsOf(heading);
  if (columns === null) return { lines: [], fileProblem: rows.some((row) => row.some((cell) => cell !== '')) ? 'columns' : 'empty' };
  const filled = body.map((fields, index) => ({ fields, line: index + 2 })).filter(({ fields }) => fields.some((cell) => cell !== ''));
  if (filled.length === 0) return { lines: [], fileProblem: 'empty' };
  if (filled.length > VISIT_FILE_MOST_LINES) return { lines: [], fileProblem: 'tooMany' };
  return { lines: filled.map(({ fields, line }) => lineOf(fields, columns, line)), fileProblem: null };
}

/** The members the file's lines name, each once, for the preview to read. */
export function visitKeysOf(read: VisitReadFile): string[] {
  return [...new Set(read.lines.flatMap((line) => (line.ok ? [line.key] : [])))];
}

/** What is wrong with a line once its member and table are known: as read, no such member, the reader's own record, or no such table. */
export type VisitPreviewProblem = VisitReadProblem | 'unknown' | 'own' | 'unknownTable';

/** A line as the preview shows it: the visit with its member and table, or what is wrong. */
export type VisitPreviewLine =
  | (VisitFileLine & { readonly ok: true; readonly member: BonusFileMember; readonly tableName: string })
  | { readonly line: number; readonly ok: false; readonly problem: VisitPreviewProblem };

/** The file as the preview shows it, and the lines to save: none while any line is wrong. */
export interface VisitPreview {
  readonly lines: readonly VisitPreviewLine[];
  readonly toSave: readonly VisitFileLine[] | null;
}

/** A table as a file names it: its id, and its name in tables setup. */
export type NamedTable = Pick<FloorTable, 'id' | 'name'>;

/** One line read, with its member and its table by name (as tables setup names it, any case). */
function previewLineOf(line: VisitReadLine, members: readonly BonusFileMember[], tables: readonly NamedTable[]): VisitPreviewLine {
  if (!line.ok) return line;
  const member = members.find((one) => one.key === line.key);
  const table = tables.find((one) => plain(one.name) === plain(line.table));
  if (member === undefined) return { line: line.line, ok: false, problem: 'unknown' };
  if (member.isOwn) return { line: line.line, ok: false, problem: 'own' };
  if (table === undefined) return { line: line.line, ok: false, problem: 'unknownTable' };
  return { line: line.line, ok: true, member, memberId: member.memberId, tableId: table.id, tableName: table.name, openedAt: line.openedAt, closedAt: line.closedAt, reason: line.reason };
}

/** The file with its members and the venue's tables: every line, and the lines to save once none is wrong. */
export function visitPreviewOf(read: VisitReadFile, members: readonly BonusFileMember[], tables: readonly NamedTable[]): VisitPreview {
  const lines = read.lines.map((line) => previewLineOf(line, members, tables));
  const isEveryOk = lines.length > 0 && lines.every((line) => line.ok);
  return {
    lines,
    toSave: isEveryOk ? lines.flatMap((line) => (line.ok ? [{ line: line.line, memberId: line.memberId, tableId: line.tableId, openedAt: line.openedAt, closedAt: line.closedAt, reason: line.reason }] : [])) : null,
  };
}
