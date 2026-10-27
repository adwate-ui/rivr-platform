import type { ArchiveFailure } from '@rivr/db/exports';
import { formatNumber, t, type MessageKey } from '@rivr/i18n';
import { ErrorMessage, Stack, Text } from '@rivr/ui';
import type { ArchiveProgress } from './archive.ts';
import type { ArchiveState } from './useArchiveExport.ts';

const FAILURE_COPY: Readonly<Record<ArchiveFailure, MessageKey>> = {
  not_allowed: 'console.exportArchiveFailures.notAllowed',
  no_key: 'console.exportArchiveFailures.noKey',
  no_member: 'console.exportArchiveFailures.noMember',
  unavailable: 'console.exportArchiveFailures.unavailable',
};

function progressText(progress: ArchiveProgress | null): string {
  if (progress === null) return t('common.loading');
  if (progress.step === 'table') return t('console.exportArchive.readingTable', { name: progress.name, done: String(progress.done), of: String(progress.of) });
  if (progress.step === 'files') return t('console.exportArchive.readingFiles', { done: String(progress.done), of: String(progress.of) });
  return t('console.exportArchive.locking');
}

/** How the archive is going: its progress, where it was saved, or why it was not made. */
export function ArchiveStatus({ state }: { state: ArchiveState }) {
  if (state.status === 'running') return <Text tone="muted">{progressText(state.progress)}</Text>;
  if (state.status === 'failed') return <ErrorMessage>{t(FAILURE_COPY[state.failure])}</ErrorMessage>;
  if (state.status === 'idle') return null;
  const { archive, fileName } = state;
  return (
    <Stack gap={2}>
      <Text>{t('console.exportArchive.done', {
        file: fileName, rows: formatNumber(archive.rows), tables: formatNumber(archive.tables), files: formatNumber(archive.files),
      })}</Text>
      {archive.unread.length > 0 ? <Text tone="muted">{t('console.exportArchive.filesUnread', { count: String(archive.unread.length) })}</Text> : null}
    </Stack>
  );
}
