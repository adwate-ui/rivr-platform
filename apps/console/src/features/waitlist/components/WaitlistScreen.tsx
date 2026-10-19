import { useFloorTables, useStaffVenue, useWaitlistBoard, type FloorTable } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { GameList } from './GameList.tsx';

/** The floor's waitlists (#38), one per game and stake, for staff with waitlist.manage. */
export function WaitlistScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) {
    return <Screen title={t('console.waitlist.title')} status="error" errorText={t('console.waitlist.notAllowed')} />;
  }
  return <Board venueId={staff.venue.venueId} />;
}

/** Each of the venue's games and stakes once, in floor order: its tables share one list. */
function gamesOf(tables: readonly FloorTable[], venueId: string): FloorTable[] {
  const here = tables.filter((table) => table.venueId === venueId);
  return here.filter((table, index) => here.findIndex((other) => other.tableTypeId === table.tableTypeId) === index);
}

function Board({ venueId }: { venueId: string }) {
  const tables = useFloorTables();
  const board = useWaitlistBoard(venueId);
  const title = t('console.waitlist.title');
  if (tables.isPending || board.isPending) return <Screen title={title} status="loading" />;
  if (tables.isError || board.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([tables.refetch(), board.refetch()])} />;
  }
  return (
    <Screen title={title}>
      <Stack gap={10}>
        {gamesOf(tables.data, venueId).map((game) => (
          <GameList key={game.tableTypeId} venueId={venueId} game={game}
            entries={board.data.filter((entry) => entry.tableTypeId === game.tableTypeId)} />
        ))}
      </Stack>
    </Screen>
  );
}
