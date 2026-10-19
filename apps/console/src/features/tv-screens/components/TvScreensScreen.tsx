import { useStaffVenue, useVenueTvs, type StaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { PairTvForm } from './PairTvForm.tsx';
import { TvRow } from './TvRow.tsx';

/** The venue's TVs (#49), for staff with devices.manage: pair one by the code it shows, change what it shows, unpair it. */
export function TvScreensScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('devices.manage')) {
    return <Screen title={t('console.tvs.title')} status="error" errorText={t('console.tvs.notAllowed')} />;
  }
  return <TvList venue={staff.venue} />;
}

function TvList({ venue }: { venue: StaffVenue }) {
  const venueId = venue.venueId;
  const tvs = useVenueTvs(venueId);
  const title = t('console.tvs.title');
  if (tvs.isPending) return <Screen title={title} status="loading" />;
  // A failed refresh keeps what was known, so a code half typed stays put.
  if (tvs.data === undefined) return <Screen title={title} status="error" onRetry={() => void tvs.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {tvs.data.length === 0 ? <Text tone="muted">{t('console.tvs.empty')}</Text> : (
          <Stack gap={4} divided>
            {tvs.data.map((tv) => <TvRow key={tv.deviceId} venueId={venueId} tv={tv} />)}
          </Stack>
        )}
        <PairTvForm venueId={venueId} venueName={venue.venueName} isPractice={venue.isPractice} />
      </Stack>
    </Screen>
  );
}
