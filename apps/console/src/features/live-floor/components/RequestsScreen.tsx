import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, ToastProvider } from '@rivr/ui';
import { useState } from 'react';
import { AlsoWaiting } from './AlsoWaiting.tsx';
import { FloorSheets, useRequestOpeners, type FloorSheet } from './FloorSheets.tsx';
import { RequestList } from './RequestList.tsx';
import { useFloorData, useNow, type FloorData } from './useFloorData.ts';
import { useRequestChanges } from './useRequestChanges.ts';
import { useRequestQueue } from './useRequestQueue.ts';
import { useSeatChanges } from './useSeatChanges.ts';
import { useTableChanges } from './useTableChanges.ts';

interface RequestsProps {
  venueId: string;
  permissions: readonly string[];
}

/** A phone has no folded panel to open when a request arrives. */
const NOTHING = () => undefined;

/** The requests once read, with the sheets their actions and names open. */
function RequestsReady({ venueId, permissions, data }: RequestsProps & { data: FloorData }) {
  const now = useNow();
  const [sheet, setSheet] = useState<FloorSheet | null>(null);
  const queue = useRequestQueue(data.requests, NOTHING);
  const changes = { requests: useRequestChanges(venueId), seats: useSeatChanges(venueId), tables: useTableChanges(venueId) };
  const { onLeave, onOpen } = useRequestOpeners(data, setSheet);
  return (
    <Stack gap={6}>
      <RequestList requests={queue.shown} tables={data.tables} targets={data.targets} now={now} fresh={queue.fresh} changes={changes.requests}
        onLeave={onLeave} onOpen={onOpen} />
      <AlsoWaiting venueId={venueId} permissions={permissions} />
      <FloorSheets venueId={venueId} sheet={sheet} data={data} now={now} permissions={permissions} changes={changes} onSheet={setSheet} />
    </Stack>
  );
}

/** Requests read for the floor alone; anyone else has none to act on. */
function Requests({ venueId, permissions }: RequestsProps) {
  const floor = useFloorData(venueId, permissions);
  const title = t('console.floor.requests.title');
  if (!permissions.includes('waitlist.manage')) return <Screen title={title} status="empty" emptyText={t('console.floor.requests.allClear')} />;
  if (floor.status === 'loading' || (floor.status === 'ready' && floor.data.requests === undefined)) return <Screen title={title} status="loading" loadingLook="rows" />;
  if (floor.status === 'error') return <Screen title={title} status="error" onRetry={floor.retry} />;
  return <Screen title={title}><RequestsReady venueId={venueId} permissions={permissions} data={floor.data} /></Screen>;
}

/**
 * Requests on a phone (console v3): the floor's requests as a screen of their own below 768 px, oldest first, each with
 * its actions and Undo; from 768 px they sit beside the Live floor.
 */
export function RequestsScreen() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready') return null;
  return (
    <ToastProvider place="console">
      <Requests venueId={staff.venue.venueId} permissions={staff.venue.permissions} />
    </ToastProvider>
  );
}
