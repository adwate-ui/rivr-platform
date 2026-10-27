import { useCallback, useMemo } from 'react';
import type { RivrClient } from './client.ts';
import type { Json } from './database.types.ts';
import { signedKycImageUrl } from './kycImages.ts';
import { useRivrData } from './provider.tsx';

/** What a console table's export records (#102): the table, every filter in force, the format and the rows. */
export interface TableExportRecord {
  readonly what: string;
  readonly filter: string;
  readonly format: 'csv' | 'xlsx';
  readonly rows: number;
}

/**
 * Records a console table's export in the audit log before its file is saved (#102), alerting the owner
 * when it is large: resolves true once recorded, false when it was not, and then nothing is saved.
 * Its own subpath (@rivr/db/exports), off the player's first load.
 */
export function useRecordTableExport(venueId: string) {
  const { client } = useRivrData();
  return useCallback(async ({ what, filter, format, rows }: TableExportRecord): Promise<boolean> => {
    const { error } = await client.rpc('record_table_export', { p_venue_id: venueId, p_what: what, p_filter: filter, p_format: format, p_rows: rows });
    return error === null;
  }, [client, venueId]);
}

/** One table an export archive holds (#103), with its columns in order. */
export interface ArchiveTable {
  readonly name: string;
  readonly columns: readonly string[];
}

/** An archive started (#103): its id, the key it is encrypted to (the owner's backup key), and every table in it. */
export interface ArchivePlan {
  readonly archiveId: string;
  readonly recipient: string;
  readonly tables: readonly ArchiveTable[];
}

/** One page of a table: each row's cells as the database writes them, null as null; `after` asks for the next page. */
export interface ArchivePage {
  readonly rows: readonly (readonly (string | null)[])[];
  /** Null on the last page. */
  readonly after: Json | null;
}

/** Why an archive was not made. */
export type ArchiveFailure = 'not_allowed' | 'no_key' | 'no_member' | 'unavailable';

const ARCHIVE_FAILURE_BY_CODE: Readonly<Record<string, ArchiveFailure>> = { '42501': 'not_allowed', RVKEY: 'no_key', P0002: 'no_member' };

/** The failure a refused step of an archive stands for; any other trouble (the network, a photo) is unavailable. */
export function archiveFailureOf(error: unknown): ArchiveFailure {
  const code: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : undefined;
  return (typeof code === 'string' ? ARCHIVE_FAILURE_BY_CODE[code] : undefined) ?? 'unavailable';
}

/** Rows asked for at a time. */
export const ARCHIVE_PAGE_ROWS = 2000;

const isJsonObject = (value: Json): value is { [key: string]: Json | undefined } => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTexts = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isCells = (value: unknown): value is (string | null)[] => Array.isArray(value) && value.every((item) => typeof item === 'string' || item === null);

function tableOf(table: Json): ArchiveTable {
  if (!isJsonObject(table) || typeof table.name !== 'string' || !isTexts(table.columns)) throw new Error('start_export_archive answered a table without its columns');
  return { name: table.name, columns: table.columns };
}

function planOf(data: Json): ArchivePlan {
  if (!isJsonObject(data) || typeof data.archive_id !== 'string' || typeof data.recipient !== 'string' || !Array.isArray(data.tables)) {
    throw new Error('start_export_archive answered without an archive, a key and tables');
  }
  return { archiveId: data.archive_id, recipient: data.recipient, tables: data.tables.map(tableOf) };
}

function pageOf(data: Json): ArchivePage {
  if (!isJsonObject(data) || !Array.isArray(data.rows) || !data.rows.every(isCells)) throw new Error('export_archive_rows answered without rows');
  return { rows: data.rows, after: data.after ?? null };
}

/** An archive's start, its pages and its photos, for a super admin at one venue. Each throws when refused. */
function archiveSource(client: RivrClient, venueId: string) {
  return {
    /** Starts an archive, which records it in the audit log: the whole venue, or one member; photos only with a reason. */
    start: async (memberId: string | null, kycReason: string | null): Promise<ArchivePlan> => {
      const { data, error } = await client.rpc('start_export_archive', {
        p_venue_id: venueId, ...(memberId === null ? {} : { p_member_id: memberId }), ...(kycReason === null ? {} : { p_kyc_reason: kycReason }),
      });
      if (error) throw error;
      return planOf(data);
    },
    page: async (archiveId: string, table: string, after: Json | null): Promise<ArchivePage> => {
      const { data, error } = await client.rpc('export_archive_rows', {
        p_archive_id: archiveId, p_table: table, p_limit: ARCHIVE_PAGE_ROWS, ...(after === null ? {} : { p_after: after }),
      });
      if (error) throw error;
      return pageOf(data);
    },
    /** Says a full archive is saved, once the browser has written it, with the file's SHA-256 and size: a purge needs one (#432). */
    complete: async (archiveId: string, sha256: string, bytes: number): Promise<void> => {
      const { error } = await client.rpc('complete_export_archive', { p_archive_id: archiveId, p_sha256: sha256, p_bytes: bytes });
      if (error) throw error;
    },
    kycPhoto: async (path: string): Promise<Uint8Array> => {
      const response = await fetch(await signedKycImageUrl(client, path));
      if (!response.ok) throw new Error(`KYC photo ${path}: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** Where the console makes an export archive from (#103): its start, each table a page at a time, its KYC photos. */
export type ArchiveSource = ReturnType<typeof archiveSource>;

/** The archive source for a super admin at this venue. */
export function useArchiveSource(venueId: string): ArchiveSource {
  const { client } = useRivrData();
  return useMemo(() => archiveSource(client, venueId), [client, venueId]);
}
