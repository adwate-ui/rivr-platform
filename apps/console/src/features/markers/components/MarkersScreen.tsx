import type { Permission } from '@rivr/contracts';
import { useCreditRoom, useStaffVenue } from '@rivr/db';
import { formatMoney, formatNumber, t } from '@rivr/i18n';
import { Grid, Money, Screen, Stack, Text } from '@rivr/ui';
import { CreditLines } from './CreditLines.tsx';
import { OpenMarkers } from './OpenMarkers.tsx';
import { SetLimitForm } from './SetLimitForm.tsx';

// As the database's reads allow: staff who set limits, issue markers or read the ledger.
const SEES_CREDIT: readonly Permission[] = ['markers.manage_limits', 'markers.issue', 'ledger.read'];

/**
 * Markers (#73; scope-v1 module 5): the room's exposure against its cap and the credit rules, every
 * member's credit line with limits waiting for a super admin first, and setting a limit. Issuing
 * markers joins with #74.
 */
export function MarkersScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.markers.title');
  const { permissions, venueId, role } = staff.venue;
  if (!SEES_CREDIT.some((permission) => permissions.includes(permission))) {
    return <Screen title={title} status="error" errorText={t('console.markers.notAllowed')} />;
  }
  return <Markers title={title} venueId={venueId} canSet={permissions.includes('markers.manage_limits')} isSuperAdmin={role === 'super_admin'} />;
}

function Markers({ title, venueId, canSet, isSuperAdmin }: { title: string; venueId: string; canSet: boolean; isSuperAdmin: boolean }) {
  const room = useCreditRoom(venueId);
  if (room.isPending) return <Screen title={title} status="loading" />;
  if (room.isError) return <Screen title={title} status="error" onRetry={() => void room.refetch()} />;
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8}>
        <Stack gap={8}>
          {room.data === null ? null : (
            <Stack gap={1}>
              <Text variant="small" tone="muted">{t('console.markers.exposure')}</Text>
              <Money paise={room.data.exposure} size="lead" />
              <Text variant="small" tone="muted">{t('console.markers.exposureOf', { exposure: formatMoney(room.data.exposure), cap: formatMoney(room.data.cap) })}</Text>
              <Text variant="small" tone="muted">{t('console.markers.rules', { threshold: formatMoney(room.data.threshold), visits: formatNumber(room.data.minimumVisits) })}</Text>
            </Stack>
          )}
          <OpenMarkers venueId={venueId} />
          <CreditLines venueId={venueId} isSuperAdmin={isSuperAdmin} />
        </Stack>
        {canSet && room.data !== null ? <SetLimitForm venueId={venueId} threshold={room.data.threshold} /> : null}
      </Grid>
    </Screen>
  );
}
