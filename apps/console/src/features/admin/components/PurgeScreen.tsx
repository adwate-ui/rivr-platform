import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { LastPurgeFiles } from './PurgeParts.tsx';
import { PurgeSteps } from './PurgeSteps.tsx';

/**
 * Purge (#432; features "Purge"; decision 0239), for super admins at a live venue, in numbered steps (console v3): freeze
 * it; one super admin asks for the purge and another (A4-13) makes and saves the full archive with the KYC photos, sees
 * what the purge deletes and types the venue's name; then its files go. The practice venue resets to its seed instead
 * (#104).
 */
export function PurgeScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.purge.title');
  if (!staff.venue.permissions.includes('purge.run')) return <Screen title={title} status="error" errorText={t('console.purge.notAllowed')} />;
  if (staff.venue.isPractice) return <Screen title={title} status="error" errorText={t('console.purge.practice')} />;
  return (
    <Screen title={title}>
      <Stack gap={6}>
        <Text>{t('console.purge.intro')}</Text>
        <LastPurgeFiles venueId={staff.venue.venueId} />
        <PurgeSteps venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
