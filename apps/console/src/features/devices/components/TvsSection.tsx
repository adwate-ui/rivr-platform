import { useStaffVenue, useVenueTvs, type StaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import type { ReactNode } from 'react';
import { PairingWindow } from './PairingWindow.tsx';
import { PairTvForm } from './PairTvForm.tsx';
import { TvRow } from './TvRow.tsx';

/**
 * The venue's TVs (#49), for staff with tvs.manage: pair one by the code it shows, change what it shows, unpair it. `above`
 * is drawn first under the tab's title: the TVs' own settings (redesign RD-18), which the Settings screen gives.
 */
export function TvsSection({ above }: { above?: ReactNode }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('tvs.manage')) {
    return <Screen level={2} title={t('console.tvs.title')} status="error" errorText={t('console.tvs.notAllowed')} />;
  }
  return <TvList venue={staff.venue} above={above} />;
}

function TvList({ venue, above }: { venue: StaffVenue; above: ReactNode }) {
  const venueId = venue.venueId;
  const tvs = useVenueTvs(venueId);
  const title = t('console.tvs.title');
  if (tvs.isPending) return <Screen level={2} title={title} status="loading" />;
  // A failed refresh keeps what was known, so a code half typed stays put.
  if (tvs.data === undefined) return <Screen level={2} title={title} status="error" onRetry={() => void tvs.refetch()} />;
  return (
    <Screen level={2} title={title}>
      <Stack gap={8}>
        {above}
        {/* The TVs paired, then the form to pair one (console v3), with its own heading so staff the TV sends here find it. */}
        {tvs.data.length === 0 ? <Text tone="muted">{t('console.tvs.empty')}</Text> : (
          <Stack gap={4} divided>
            {tvs.data.map((tv) => <TvRow key={tv.deviceId} venueId={venueId} tv={tv} />)}
          </Stack>
        )}
        <PairTvForm venueId={venueId} venueName={venue.venueName} isPractice={venue.isPractice} />
        {venue.isPractice ? null : <PairingWindow venueId={venueId} canSwitch={venue.permissions.includes('venue.configure')} />}
      </Stack>
    </Screen>
  );
}
