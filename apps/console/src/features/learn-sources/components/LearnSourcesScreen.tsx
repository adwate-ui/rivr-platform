import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { SourceTable } from './SourceTable.tsx';
import { SourceUpload } from './SourceUpload.tsx';

/** Learn sources (#131; decision 0016): the venue's licensed encodings and their licences, and adding one once it passes the drill engine's checks. */
export function LearnSourcesScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.learnSources.title');
  if (!staff.venue.permissions.includes('learn.manage_sources')) return <Screen title={title} status="error" errorText={t('console.learnSources.notAllowed')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <SourceTable venueId={staff.venue.venueId} />
        <SourceUpload venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
