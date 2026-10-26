import { useStaffVenue } from '@rivr/db';
import type { ArchiveFailure } from '@rivr/db/exports';
import { formatNumber, t, type MessageKey } from '@rivr/i18n';
import { Divider, ErrorMessage, Screen, Stack, Text } from '@rivr/ui';
import type { ArchiveProgress } from './archive.ts';
import { FullArchiveForm, MemberArchiveForm } from './ArchiveForms.tsx';
import { useArchiveExport, type ArchiveState } from './useArchiveExport.ts';

const FAILURE_COPY: Readonly<Record<ArchiveFailure, MessageKey>> = {
  not_allowed: 'console.exportArchiveFailures.notAllowed',
  no_key: 'console.exportArchiveFailures.noKey',
  no_member: 'console.exportArchiveFailures.noMember',
  unavailable: 'console.exportArchiveFailures.unavailable',
};

function progressText(progress: ArchiveProgress | null): string {
  if (progress === null) return t('common.loading');
  if (progress.step === 'table') return t('console.exportArchive.readingTable', { name: progress.name, done: String(progress.done), of: String(progress.of) });
  if (progress.step === 'photos') return t('console.exportArchive.readingPhotos', { done: String(progress.done), of: String(progress.of) });
  return t('console.exportArchive.locking');
}

/** How the archive is going: its progress, where it was saved, or why it was not made. */
function ArchiveStatus({ state }: { state: ArchiveState }) {
  if (state.status === 'running') return <Text tone="muted">{progressText(state.progress)}</Text>;
  if (state.status === 'failed') return <ErrorMessage>{t(FAILURE_COPY[state.failure])}</ErrorMessage>;
  if (state.status === 'idle') return null;
  const { archive, fileName } = state;
  return (
    <Stack gap={2}>
      <Text>{t('console.exportArchive.done', {
        file: fileName, rows: formatNumber(archive.rows), tables: formatNumber(archive.tables), photos: formatNumber(archive.photos),
      })}</Text>
      {archive.unread.length > 0 ? <Text tone="muted">{t('console.exportArchive.photosUnread', { count: String(archive.unread.length) })}</Text> : null}
    </Stack>
  );
}

function ExportsPanel({ venueId }: { venueId: string }) {
  const archive = useArchiveExport(venueId);
  const isRunning = archive.state.status === 'running';
  return (
    <Stack gap={6}>
      <ArchiveStatus state={archive.state} />
      <FullArchiveForm isRunning={isRunning} onMake={(kycReason) => void archive.run({ memberId: null, memberNumber: null }, kycReason)} />
      <Divider />
      <MemberArchiveForm venueId={venueId} isRunning={isRunning}
        onExport={(member) => void archive.run({ memberId: member.memberId, memberNumber: member.memberNumber }, null)} />
    </Stack>
  );
}

/**
 * Exports (#103; features "Exports"; decision 0232), for super admins: the venue's full archive, KYC photos only
 * with a written reason, and one member's data for an access request. Both are locked to the owner's backup key.
 */
export function ExportsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.exportArchive.title');
  if (!staff.venue.permissions.includes('exports.full')) return <Screen title={title} status="error" errorText={t('console.exportArchive.notAllowed')} />;
  return (
    <Screen title={title}>
      <ExportsPanel venueId={staff.venue.venueId} />
    </Screen>
  );
}
