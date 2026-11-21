import { BONUS_FILE_MOST_LINES, type BonusFileLineToSave, type BonusFileMember } from '@rivr/db/bonusFile';
import { bonusFileRun, bonusFileTotals, type BonusFileLine, type BonusHolding } from '@rivr/domain/bonus';
import { chipsToPaise, type Paise } from '@rivr/domain/money';
import { chipsFrom } from './GiveBonusChips.tsx';

/** What is wrong with a line as read: no member number or mobile, no Add or Use, chips not whole fifties, or no reason. */
export type ReadProblem = 'member' | 'type' | 'chips' | 'reason';

/** One line of the file: whom (a member number, or a mobile as +91 and ten digits), Add or Use, chips and why; or what is wrong. */
export type ReadLine =
  | { readonly line: number; readonly ok: true; readonly key: string; readonly kind: 'add' | 'use'; readonly chips: number; readonly reason: string }
  | { readonly line: number; readonly ok: false; readonly problem: ReadProblem };

/** A Bonus file as read: each line, or what is wrong with the whole file. */
export interface ReadFile {
  readonly lines: readonly ReadLine[];
  readonly fileProblem: 'columns' | 'empty' | 'tooMany' | null;
}

// The words a type is written in. A Map, so a word such as `constructor` is no type.
const KINDS = new Map<string, 'add' | 'use'>([['add', 'add'], ['added', 'add'], ['give', 'add'], ['use', 'use'], ['used', 'use'], ['redeem', 'use'], ['redeemed', 'use']]);

/** A heading or a value as compared: lower case, with spaces and underscores as one space. */
const plain = (text: string) => text.toLowerCase().replace(/[\s_]+/g, ' ').trim();

/** A member number, or a mobile as +91 and ten digits, from what a line gives (spaces, dashes, +91 or 91 allowed); null for neither. */
export function memberKeyOf(text: string): string | null {
  const digits = text.replace(/[\s()-]/g, '');
  const mobile = /^(?:\+?91)?([6-9][0-9]{9})$/.exec(digits)?.[1];
  if (mobile !== undefined) return `+91${mobile}`;
  return /^[0-9]{1,8}$/.test(digits) && Number(digits) > 0 ? String(Number(digits)) : null;
}

/** Where each column is, by its heading on the first line; null when one of the four is not there. */
function columnsOf(heading: readonly string[]) {
  const at = (...names: string[]) => heading.findIndex((cell) => names.includes(plain(cell)));
  const columns = {
    member: at('member', 'member number', 'number', 'mobile', 'phone'), kind: at('type', 'kind'), chips: at('chips', 'bonus', 'amount'), reason: at('reason', 'note'),
  };
  return Object.values(columns).some((index) => index < 0) ? null : columns;
}

/** One line's member, type, chips and reason, or the first of them that is wrong. */
function lineOf(fields: readonly string[], columns: NonNullable<ReturnType<typeof columnsOf>>, line: number): ReadLine {
  const key = memberKeyOf(fields[columns.member] ?? '');
  const kind = KINDS.get(plain(fields[columns.kind] ?? ''));
  const chips = chipsFrom((fields[columns.chips] ?? '').replace(/^₹/, ''));
  const reason = (fields[columns.reason] ?? '').trim();
  if (key === null) return { line, ok: false, problem: 'member' };
  if (kind === undefined) return { line, ok: false, problem: 'type' };
  if (chips === null) return { line, ok: false, problem: 'chips' };
  if (reason.length < 3 || reason.length > 200) return { line, ok: false, problem: 'reason' };
  return { line, ok: true, key, kind, chips, reason };
}

/** A file's rows (the nth the file's line n) as Bonus lines: the first names the columns, and an empty line is passed over. */
export function readBonusFile(rows: readonly (readonly string[])[]): ReadFile {
  const [heading, ...body] = rows;
  const columns = heading === undefined ? null : columnsOf(heading);
  if (columns === null) return { lines: [], fileProblem: rows.some((row) => row.some((cell) => cell !== '')) ? 'columns' : 'empty' };
  const filled = body.map((fields, index) => ({ fields, line: index + 2 })).filter(({ fields }) => fields.some((cell) => cell !== ''));
  if (filled.length === 0) return { lines: [], fileProblem: 'empty' };
  if (filled.length > BONUS_FILE_MOST_LINES) return { lines: [], fileProblem: 'tooMany' };
  return { lines: filled.map(({ fields, line }) => lineOf(fields, columns, line)), fileProblem: null };
}

/** The members the file's lines name, each once, for the preview to read. */
export function keysOf(read: ReadFile): string[] {
  return [...new Set(read.lines.flatMap((line) => (line.ok ? [line.key] : [])))];
}

/** What is wrong with a line once its member is known: as read, no such member, the reader's own record, some owed, or short. */
export type PreviewProblem = ReadProblem | 'unknown' | 'own' | 'owed' | 'short';

/** A line as it will save, with its member; or what is wrong with it. */
export type PreviewLine =
  | { readonly line: number; readonly ok: true; readonly kind: 'add' | 'use'; readonly chips: number; readonly reason: string; readonly member: BonusFileMember }
  | { readonly line: number; readonly ok: false; readonly problem: PreviewProblem };

/** The preview: every line, and the lines to save with the file's totals once every line is right (null until then). */
export interface Preview {
  readonly lines: readonly PreviewLine[];
  readonly toSave: { readonly lines: readonly BonusFileLineToSave[]; readonly added: Paise; readonly used: Paise } | null;
}

/** Each line with its member: unknown or one's own record is wrong; then the lines run in order (`bonusFileRun`) for what is owed or short. */
export function previewOf(read: ReadFile, members: readonly BonusFileMember[]): Preview {
  const byKey = new Map(members.map((member) => [member.key, member]));
  const named = read.lines.map((line): PreviewLine => {
    if (!line.ok) return line;
    const member = byKey.get(line.key);
    if (member === undefined) return { line: line.line, ok: false, problem: 'unknown' };
    if (member.isOwn) return { line: line.line, ok: false, problem: 'own' };
    return { line: line.line, ok: true, kind: line.kind, chips: line.chips, reason: line.reason, member };
  });
  const going = named.flatMap((line) => (line.ok ? [line] : []));
  const ruleLines: BonusFileLine[] = going.map((line) => ({ memberId: line.member.memberId, kind: line.kind, amount: chipsToPaise(BigInt(line.chips)) }));
  const held = new Map<string, BonusHolding>(going.map((line) => [line.member.memberId, { inForce: line.member.inForce, owed: line.member.owed }]));
  const run = bonusFileRun(ruleLines, held);
  const refusals = new Map(going.map((line, index) => [line.line, run.refusals[index] ?? null]));
  const lines = named.map((line): PreviewLine => {
    const refusal = line.ok ? refusals.get(line.line) ?? null : null;
    return refusal === null ? line : { line: line.line, ok: false, problem: refusal === 'owed' ? 'owed' : 'short' };
  });
  if (lines.some((line) => !line.ok)) return { lines, toSave: null };
  const toSave = going.map(({ line, member, kind, chips, reason }) => ({ line, memberId: member.memberId, kind, chips, reason }));
  return { lines, toSave: { lines: toSave, ...bonusFileTotals(ruleLines) } };
}
