import {
  useFloorNight, useFloorSeats, useFloorTables, useHeldSeats, useStaffVenue, type FloorNight, type FloorTable, type HeldSeat, type SeatedPlayer,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { Grid, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { LeavingList } from './LeavingList.tsx';
import { LeftOwingCallTime } from './LeftOwingCallTime.tsx';
import { RoomPlan } from './RoomPlan.tsx';
import { TableDetail } from './TableDetail.tsx';

/**
 * Live floor (#77, #81; the prototype's console): rake tonight and how many are seated; every table
 * seen from above, room by room, with who sits where, its rake, dealer and hands per hour; and the
 * chosen table beside, with its night so far, its seats and its recent hands. The floor
 * (waitlist.manage) seats, moves and lets players leave; floor managers open and close tables and set
 * must-move tables; admins let a player leave before call time, seated or gone from their seat (#79).
 * The floor marks a player leaving, and the Leaving list shows when each seat opens (decision 0163).
 */
export function LiveFloorScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <Floor venueId={staff.venue.venueId} permissions={staff.venue.permissions} />;
}

/** The floor's four reads once every one has arrived; null until then. */
function loaded(tables: FloorTable[] | undefined, seats: SeatedPlayer[] | undefined, held: HeldSeat[] | undefined, night: FloorNight | undefined) {
  if (tables === undefined || seats === undefined || held === undefined || night === undefined) return null;
  return { tables, seats, held, night };
}

function Floor({ venueId, permissions }: { venueId: string; permissions: readonly string[] }) {
  const reads = { tables: useFloorTables(), seats: useFloorSeats(venueId), held: useHeldSeats(venueId), night: useFloorNight(venueId) };
  const [chosenId, setChosenId] = useState<string | null>(null);
  const title = t('console.liveFloor.title');
  const data = loaded(reads.tables.data, reads.seats.data, reads.held.data, reads.night.data);
  if (data === null) {
    const all = Object.values(reads);
    if (all.some((read) => read.isError)) return <Screen title={title} status="error" onRetry={() => void Promise.all(all.map((read) => read.refetch()))} />;
    return <Screen title={title} status="loading" />;
  }
  const here = data.tables.filter((table) => table.venueId === venueId);
  const chosen = here.find((table) => table.id === chosenId) ?? here[0];
  if (chosen === undefined) return <Screen title={title} status="empty" emptyText={t('console.liveFloor.empty')} />;
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8}>
        <Stack gap={8}>
          <RoomPlan tables={here} seats={data.seats} held={data.held} night={data.night} canSeeSeats={permissions.includes('members.read')}
            chosenId={chosen.id} onChoose={setChosenId} />
          <LeavingList venueId={venueId} tables={here} seats={data.seats} isFloor={permissions.includes('waitlist.manage')} />
          {permissions.includes('call_time.override') ? <LeftOwingCallTime venueId={venueId} /> : null}
        </Stack>
        <TableDetail key={chosen.id} venueId={venueId} table={chosen} tables={here} permissions={permissions}
          seats={data.seats.filter((seat) => seat.tableId === chosen.id)} held={data.held.filter((seat) => seat.tableId === chosen.id)}
          night={data.night.tables.find((figures) => figures.tableId === chosen.id)} />
      </Grid>
    </Screen>
  );
}
