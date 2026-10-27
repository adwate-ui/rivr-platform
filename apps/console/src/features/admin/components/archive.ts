import type { ArchivePage, ArchivePlan, ArchiveSource, ArchiveTable } from '@rivr/db/exports';
import { zipStored } from '@rivr/ui';

/**
 * The super admin's export archive (#103; decision 0232), made in the browser: every table of the plan as CSV,
 * read a page at a time, with a manifest of the rows in each, and the venue's files as the server listed them (expense
 * receipts, and KYC photos when asked for with a reason, #432);
 * zipped, then locked to the owner's backup key. Starting it records it in the audit log, before anything is read.
 */

/** A cell as PostgreSQL's COPY quotes CSV, as the nightly export does: null an empty cell, quoted only when it must be. */
export function archiveCell(cell: string | null): string {
  if (cell === null) return '';
  return cell === '' || /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** A table as CSV: its header row, then a line per row. */
export function archiveCsv(columns: readonly string[], rows: ArchivePage['rows']): string {
  return [columns, ...rows].map((row) => `${row.map(archiveCell).join(',')}\n`).join('');
}

/** Where an archive has got to. */
export type ArchiveProgress =
  | { readonly step: 'table'; readonly name: string; readonly done: number; readonly of: number }
  | { readonly step: 'files'; readonly done: number; readonly of: number }
  | { readonly step: 'locking' };

export interface ArchiveRequest {
  readonly venueId: string;
  /** One member's rows, for an access request; null for the whole venue. */
  readonly memberId: string | null;
  /** Why the KYC photos are needed; null leaves them out. */
  readonly kycReason: string | null;
  readonly madeAt: Date;
}

export interface Archive {
  /** The archive as the database recorded it as started. */
  readonly archiveId: string;
  /** The zip, locked to the owner's backup key. */
  readonly file: Uint8Array;
  readonly tables: number;
  readonly rows: number;
  /** The listed files the archive holds. */
  readonly files: number;
  /** Listed files that could not be read (<bucket>/<path>): the manifest lists them, and a purge leaves them in storage. */
  readonly unread: readonly string[];
}

async function readTable(source: ArchiveSource, archiveId: string, table: ArchiveTable): Promise<ArchivePage['rows']> {
  const rows: ArchivePage['rows'][number][] = [];
  let after: ArchivePage['after'] = null;
  do {
    const page = await source.page(archiveId, table.name, after);
    rows.push(...page.rows);
    after = page.after;
  } while (after !== null);
  return rows;
}

/** Every table's CSV and its rows. */
async function readTables(source: ArchiveSource, plan: ArchivePlan, onProgress: (progress: ArchiveProgress) => void) {
  const files: Record<string, string | Uint8Array> = {};
  const counts: Record<string, number> = {};
  for (const [index, table] of plan.tables.entries()) {
    onProgress({ step: 'table', name: table.name, done: index + 1, of: plan.tables.length });
    const rows = await readTable(source, plan.archiveId, table);
    // A member's staff notes (`staff-notes/<table>`, #498) sit in their own folder, apart from the tables.
    files[table.name.startsWith('staff-notes/') ? `${table.name}.csv` : `tables/${table.name}.csv`] = archiveCsv(table.columns, rows);
    counts[table.name] = rows.length;
  }
  return { files, counts };
}

/** One listed file (<bucket>/<path>): a KYC photo through its signed address, a receipt from its bucket. */
function readFile(source: ArchiveSource, file: string): Promise<Uint8Array> {
  if (file.startsWith('kyc/')) return source.kycPhoto(file.slice('kyc/'.length));
  if (file.startsWith('expense-receipts/')) return source.receipt(file.slice('expense-receipts/'.length));
  return Promise.reject(new Error(`Not a file an archive holds: ${file}`));
}

/** The listed files, one at a time, each kept under its bucket's folder; one that cannot be read is listed, not fatal. */
async function readFiles(source: ArchiveSource, listed: readonly string[], files: Record<string, string | Uint8Array>, onProgress: (progress: ArchiveProgress) => void) {
  const unread: string[] = [];
  for (const [index, file] of listed.entries()) {
    onProgress({ step: 'files', done: index + 1, of: listed.length });
    const bytes = await readFile(source, file).catch(() => null);
    if (bytes === null) unread.push(file);
    else files[`files/${file}`] = bytes;
  }
  return unread;
}

function manifestOf(request: ArchiveRequest, counts: Readonly<Record<string, number>>, held: number, unread: readonly string[]): string {
  return `${JSON.stringify({
    archive: 'RIVR export archive (decision 0232)',
    venue_id: request.venueId,
    member_id: request.memberId,
    made_at: request.madeAt.toISOString(),
    format: 'One CSV per table in tables/, quoted as PostgreSQL\'s COPY writes CSV: a header row, cells quoted only when they must be, an empty unquoted cell for null. Each value as the database casts it to text: true and false in full, times in UTC. Secrets (hashes, KYC keys) are left out.',
    // A member's export (#498, decision 0240): what staff wrote about the member is apart, for the owner to decide on.
    ...(request.memberId === null ? {} : {
      staff_notes: 'staff-notes/ holds what staff wrote about this member (freeze, override, KYC review and credit reasons, face-match scores), each row by its id. It is for the owner: remove it before sending the archive to the member unless the owner decides otherwise.',
    }),
    tables: counts,
    // The venue's files under files/<bucket>/: KYC photos (with a reason) and expense receipts (#432).
    files: held,
    files_unread: unread,
  }, null, 2)}\n`;
}

/** Locks a file to an age public key (`age1…`): only its private key opens it, with `age -d -i <key file>`. */
export async function lockTo(file: Uint8Array, recipient: string): Promise<Uint8Array> {
  const { Encrypter } = await import('age-encryption');
  const encrypter = new Encrypter();
  encrypter.addRecipient(recipient);
  return encrypter.encrypt(file);
}

/** Makes an archive: started (and so recorded), the tables, the files, the manifest, then the zip locked to its key. */
export async function makeArchive(source: ArchiveSource, request: ArchiveRequest, onProgress: (progress: ArchiveProgress) => void): Promise<Archive> {
  const plan = await source.start(request.memberId, request.kycReason);
  const { files, counts } = await readTables(source, plan, onProgress);
  const unread = await readFiles(source, plan.files, files, onProgress);
  files['manifest.json'] = manifestOf(request, counts, plan.files.length - unread.length, unread);
  onProgress({ step: 'locking' });
  const file = await lockTo(zipStored(files), plan.recipient);
  // A staff-notes entry is rows of a table already counted (#498).
  const rows = Object.entries(counts).filter(([name]) => !name.startsWith('staff-notes/')).reduce((total, [, count]) => total + count, 0);
  const tables = plan.tables.filter((table) => !table.name.startsWith('staff-notes/')).length;
  return { archiveId: plan.archiveId, file, tables, rows, files: plan.files.length - unread.length, unread };
}
