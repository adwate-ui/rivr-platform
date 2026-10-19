import { useDealerTablets, useFloorTables, useStaffVenue, type PairingCode } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { AddTabletForm } from './AddTabletForm.tsx';
import { TabletRow } from './TabletRow.tsx';

/** The venue's dealer tablets (#41), for staff with devices.manage: add and pair, fix to a table, revoke. */
export function TabletsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('devices.manage')) {
    return <Screen title={t('console.tablets.title')} status="error" errorText={t('console.tablets.notAllowed')} />;
  }
  return <TabletList venueId={staff.venue.venueId} />;
}

function TabletList({ venueId }: { venueId: string }) {
  const tablets = useDealerTablets(venueId);
  const tables = useFloorTables();
  // Codes given out on this screen, by tablet: shown once, never read back.
  const [codes, setCodes] = useState<Readonly<Record<string, PairingCode>>>({});
  const showCode = (code: PairingCode) => setCodes((before) => ({ ...before, [code.deviceId]: code }));
  const title = t('console.tablets.title');
  if (tablets.isPending || tables.isPending) return <Screen title={title} status="loading" />;
  // A failed refresh keeps what was known, so a code being read out or a name half typed stays put.
  if (tablets.data === undefined || tables.data === undefined) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([tablets.refetch(), tables.refetch()])} />;
  }
  const venueTables = tables.data.filter((table) => table.venueId === venueId);
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {tablets.data.length === 0 ? <Text tone="muted">{t('console.tablets.empty')}</Text> : (
          <Stack gap={4} divided>
            {tablets.data.map((tablet) => (
              <TabletRow key={tablet.deviceId} venueId={venueId} tablet={tablet} tables={venueTables}
                code={codes[tablet.deviceId] ?? null} onCode={showCode} />
            ))}
          </Stack>
        )}
        <AddTabletForm venueId={venueId} onCode={showCode} />
      </Stack>
    </Screen>
  );
}
