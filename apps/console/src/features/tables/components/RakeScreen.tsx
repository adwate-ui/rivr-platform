import { useStaffVenue, useTableTypeRake } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { RakeChangeForm } from './RakeChangeForm.tsx';
import { TableTypeRakeRow } from './TableTypeRakeRow.tsx';

/**
 * Rake (#37, scope-v1 module 3): each table type's rake now and the changes to come, and a change
 * scheduled from a time, for staff who manage settings. Hands keep the rule in force when they
 * were played, so a change never reaches back.
 */
export function RakeScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('settings.manage')) {
    return <Screen title={t('console.rake.title')} status="error" errorText={t('console.rake.notAllowed')} />;
  }
  return <RakeList venueId={staff.venue.venueId} />;
}

function RakeList({ venueId }: { venueId: string }) {
  const rake = useTableTypeRake(venueId);
  const title = t('console.rake.title');
  if (rake.isPending) return <Screen title={title} status="loading" />;
  if (rake.data === undefined) return <Screen title={title} status="error" onRetry={() => void rake.refetch()} />;
  if (rake.data.length === 0) return <Screen title={title} status="empty" emptyText={t('console.rake.empty')} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <Stack gap={6} divided>
          {rake.data.map((type) => <TableTypeRakeRow key={type.tableTypeId} venueId={venueId} type={type} />)}
        </Stack>
        <RakeChangeForm venueId={venueId} tableTypes={rake.data} />
      </Stack>
    </Screen>
  );
}
