import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Divider, Screen, Stack } from '@rivr/ui';
import { FullArchiveForm, MemberArchiveForm } from './ArchiveForms.tsx';
import { ArchiveStatus } from './ArchiveStatus.tsx';
import { useArchiveExport } from './useArchiveExport.ts';

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
