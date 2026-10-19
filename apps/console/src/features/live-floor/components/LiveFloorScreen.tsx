import { useFloorSeats, useFloorTables, useStaffVenue, type FloorTable } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { ChoiceChips, Grid, Screen, Stack } from '@rivr/ui';
import { useState } from 'react';
import { TableCard } from './TableCard.tsx';
import { TableDetail } from './TableDetail.tsx';

/**
 * Live floor (#77, the prototype's console): every table seen from above with who sits where, and
 * the chosen table's seats beside them. The floor (waitlist.manage) seats, moves and lets players
 * leave; floor managers open and close tables and set must-move tables. Rake and hands follow (#81).
 */
export function LiveFloorScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return <Floor venueId={staff.venue.venueId} permissions={staff.venue.permissions} />;
}

function Floor({ venueId, permissions }: { venueId: string; permissions: readonly string[] }) {
  const tables = useFloorTables();
  const seats = useFloorSeats(venueId);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const title = t('console.liveFloor.title');
  if (tables.isPending || seats.isPending) return <Screen title={title} status="loading" />;
  if (tables.isError || seats.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([tables.refetch(), seats.refetch()])} />;
  }
  const here: FloorTable[] = tables.data.filter((table) => table.venueId === venueId);
  if (here.length === 0) return <Screen title={title} status="empty" emptyText={t('console.liveFloor.empty')} />;
  const chosen = here.find((table) => table.id === chosenId) ?? here[0];
  const options = here.map((table) => ({ value: table.id, label: table.name }));
  return (
    <Screen title={title}>
      <Grid columns={2} gap={8}>
        {/* In a Stack, so the cards keep their own height beside the taller seat list. */}
        <Stack gap={4}>
          <Grid columns={2} gap={4}>
            {here.map((table) => <TableCard key={table.id} table={table} seats={seats.data.filter((seat) => seat.tableId === table.id)} />)}
          </Grid>
        </Stack>
        {chosen === undefined ? null : (
          <Stack gap={6}>
            <ChoiceChips label={t('console.liveFloor.table')} mode="one" options={options} selected={[chosen.id]}
              onChange={([id]) => { if (id !== undefined) setChosenId(id); }} />
            <TableDetail key={chosen.id} venueId={venueId} table={chosen} tables={here} permissions={permissions}
              seats={seats.data.filter((seat) => seat.tableId === chosen.id)} stakes={formatStakes(chosen.smallBlind, chosen.bigBlind)} />
          </Stack>
        )}
      </Grid>
    </Screen>
  );
}
