import { useFloorTables, useInterestLists, useStaffVenue, useWaitlistBoard, type FloorTable, type InterestList } from '@rivr/db';
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
  return <Board venueId={staff.venue.venueId} canOpen={staff.venue.permissions.includes('floor.manage')} />;
}

/** Each of the venue's games and stakes once, in floor order: its tables share one list. */
function gamesOf(tables: readonly FloorTable[], venueId: string): FloorTable[] {
  const here = tables.filter((table) => table.venueId === venueId);
  return here.filter((table, index) => here.findIndex((other) => other.tableTypeId === table.tableTypeId) === index);
}

/** A game's interest while it is not running, with a closed table to open (#113). */
function interestOf(game: FloorTable, lists: readonly InterestList[], tables: readonly FloorTable[], canOpen: boolean) {
  const list = lists.find((candidate) => candidate.tableTypeId === game.tableTypeId);
  const ofGame = tables.filter((table) => table.venueId === game.venueId && table.tableTypeId === game.tableTypeId);
  // The floor's tables refresh first: once one is open, the game is running whatever the interest list last said.
  if (list === undefined || ofGame.some((table) => table.isOpen)) return undefined;
  const closedTable = ofGame.find((table) => !table.isOpen);
  return { list, closedTable, canOpen };
}

function Board({ venueId, canOpen }: { venueId: string; canOpen: boolean }) {
  const tables = useFloorTables();
  const board = useWaitlistBoard(venueId);
  // The interest lists are an addition: the waitlists show while they load, or if they fail.
  const interest = useInterestLists(venueId).data ?? [];
  const title = t('console.waitlist.title');
  if (tables.isPending || board.isPending) return <Screen title={title} status="loading" />;
  if (tables.isError || board.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([tables.refetch(), board.refetch()])} />;
  }
  const games = gamesOf(tables.data, venueId);
  if (games.length === 0) return <Screen title={title} status="empty" emptyText={t('console.waitlist.noGames')} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        {games.map((game) => (
          <GameList key={game.tableTypeId} venueId={venueId} game={game}
            tables={tables.data.filter((table) => table.venueId === venueId && table.tableTypeId === game.tableTypeId && table.isOpen)}
            entries={board.data.filter((entry) => entry.tableTypeId === game.tableTypeId)}
            interest={interestOf(game, interest, tables.data, canOpen)} />
        ))}
      </Stack>
    </Screen>
  );
}
