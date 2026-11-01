import { formatIsoDay } from '@rivr/i18n';
import { archiveFailureOf, useArchiveSource, type ArchiveFailure } from '@rivr/db/exports';
import { saveFile } from '@rivr/ui';
import { useState } from 'react';
import { makeArchive, type Archive, type ArchiveProgress } from './archive.ts';

/**
 * Where the Exports screen's archive is: not started, being made, saved, saved but not recorded (so a purge cannot follow
 * it yet, F1-27), or not made.
 */
export type ArchiveState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly progress: ArchiveProgress | null }
  | { readonly status: 'done'; readonly archive: Archive; readonly fileName: string }
  | { readonly status: 'unrecorded'; readonly archive: Archive; readonly fileName: string }
  | { readonly status: 'failed'; readonly failure: ArchiveFailure };


/** The archive's file name: `rivr-archive-2026-10-26.zip.age`, or `rivr-member-1042-2026-10-26.zip.age`. */
function fileNameOf(memberNumber: number | null, madeAt: Date): string {
  const what = memberNumber === null ? 'archive' : `member-${memberNumber}`;
  return `rivr-${what}-${formatIsoDay(madeAt)}.zip.age`;
}

/** A file's SHA-256 in hex, as `sha256sum` prints it. */
async function sha256Of(file: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(file)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Who an archive is of: the whole venue, or one member for an access request. */
export interface ArchiveSubject {
  readonly memberId: string | null;
  readonly memberNumber: number | null;
}

/**
 * Makes an archive (#103), saves it through the browser's download, and says how it went. A full archive saved but not
 * recorded is recorded again with `recordAgain`, without making it again (F1-27).
 */
export function useArchiveExport(venueId: string) {
  const source = useArchiveSource(venueId);
  const [state, setState] = useState<ArchiveState>({ status: 'idle' });
  // A full archive, written, is one a purge may follow (#432): the database keeps its SHA-256 and size.
  const record = async (archive: Archive, fileName: string) => {
    setState({ status: 'running', progress: null });
    try {
      await source.complete(archive.archiveId, await sha256Of(archive.file), archive.file.byteLength, archive.unread);
      setState({ status: 'done', archive, fileName });
    } catch {
      setState({ status: 'unrecorded', archive, fileName });
    }
  };
  const run = async ({ memberId, memberNumber }: ArchiveSubject, kycReason: string | null) => {
    const madeAt = new Date();
    setState({ status: 'running', progress: null });
    try {
      const archive = await makeArchive(source, { venueId, memberId, kycReason, madeAt }, (progress) => setState({ status: 'running', progress }));
      const fileName = fileNameOf(memberNumber, madeAt);
      saveFile(new Blob([new Uint8Array(archive.file)], { type: 'application/octet-stream' }), fileName);
      if (memberId === null) await record(archive, fileName);
      else setState({ status: 'done', archive, fileName });
    } catch (error) {
      setState({ status: 'failed', failure: archiveFailureOf(error) });
    }
  };
  const recordAgain = () => (state.status === 'unrecorded' ? record(state.archive, state.fileName) : Promise.resolve());
  return { state, run, recordAgain };
}
