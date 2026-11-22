import { csvRows } from './csv.ts';
import { xlsxRows } from './xlsx.ts';

/** Why a chosen file was not read: larger than the screen takes, or no CSV or workbook. */
export type SheetFileProblem = 'tooBig' | 'unreadable';

/** A chosen file's rows as text, the nth row the file's line or row n; or why it was not read. */
export type SheetFile =
  | { readonly ok: true; readonly rows: readonly (readonly string[])[] }
  | { readonly ok: false; readonly problem: SheetFileProblem };

/** A zip archive begins with PK; an older Excel file (.xls), which this does not read, with these eight bytes. */
const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;
const OLD_EXCEL = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const isOldExcel = (bytes: Uint8Array) => OLD_EXCEL.every((byte, index) => bytes[index] === byte);

/**
 * A file a screen lets staff choose, read in the browser and sent nowhere: a workbook (.xlsx, its first sheet) or a CSV
 * (UTF-8, its lines). Judged by its bytes, not its name. Past `mostBytes` it is not read at all.
 */
export async function readSheetFile(file: Blob, mostBytes: number): Promise<SheetFile> {
  if (file.size > mostBytes) return { ok: false, problem: 'tooBig' };
  const bytes = await file.arrayBuffer().then((buffer) => new Uint8Array(buffer), () => null);
  if (bytes === null || isOldExcel(bytes)) return { ok: false, problem: 'unreadable' };
  if (!isZip(bytes)) {
    try {
      return { ok: true, rows: csvRows(new TextDecoder().decode(bytes)) };
    } catch {
      return { ok: false, problem: 'unreadable' };
    }
  }
  const rows = await xlsxRows(bytes).catch(() => 'unreadable' as const);
  return typeof rows === 'string' ? { ok: false, problem: rows } : { ok: true, rows };
}
