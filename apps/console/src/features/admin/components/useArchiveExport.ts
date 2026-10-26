import { archiveFailureOf, useArchiveSource, type ArchiveFailure } from '@rivr/db/exports';
import { saveFile } from '@rivr/ui';
import { useState } from 'react';
import { makeArchive, type Archive, type ArchiveProgress } from './archive.ts';

/** Where the Exports screen's archive is: not started, being made, saved, or not made. */
export type ArchiveState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly progress: ArchiveProgress | null }
  | { readonly status: 'done'; readonly archive: Archive; readonly fileName: string }
  | { readonly status: 'failed'; readonly failure: ArchiveFailure };

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' });

/** The archive's file name: `rivr-archive-2026-10-26.zip.age`, or `rivr-member-1042-2026-10-26.zip.age`. */
function fileNameOf(memberNumber: number | null, madeAt: Date): string {
  const what = memberNumber === null ? 'archive' : `member-${memberNumber}`;
  return `rivr-${what}-${IST_DAY.format(madeAt)}.zip.age`;
}

/** Who an archive is of: the whole venue, or one member for an access request. */
export interface ArchiveSubject {
  readonly memberId: string | null;
  readonly memberNumber: number | null;
}

/** Makes an archive (#103), saves it through the browser's download, and says how it went. */
export function useArchiveExport(venueId: string) {
  const source = useArchiveSource(venueId);
  const [state, setState] = useState<ArchiveState>({ status: 'idle' });
  const run = async ({ memberId, memberNumber }: ArchiveSubject, kycReason: string | null) => {
    const madeAt = new Date();
    setState({ status: 'running', progress: null });
    try {
      const archive = await makeArchive(source, { venueId, memberId, kycReason, madeAt }, (progress) => setState({ status: 'running', progress }));
      const fileName = fileNameOf(memberNumber, madeAt);
      saveFile(new Blob([new Uint8Array(archive.file)], { type: 'application/octet-stream' }), fileName);
      setState({ status: 'done', archive, fileName });
    } catch (error) {
      setState({ status: 'failed', failure: archiveFailureOf(error) });
    }
  };
  return { state, run };
}
