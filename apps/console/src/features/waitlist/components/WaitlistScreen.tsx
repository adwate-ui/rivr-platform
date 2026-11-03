import { useFloorTables, useInterestLists, useStaffVenue, useWaitlistBoard, useWaitlistRequests, type FloorTable, type InterestList } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Screen, Stack, StaleNotice, Text } from '@rivr/ui';
import { GameList } from './GameList.tsx';

/** The floor's waitlists (#38), one per active table (decision 0433), for staff with waitlist.manage. */
export function WaitlistScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('waitlist.manage')) {
    return <Screen title={t('console.waitlist.title')} status="error" errorText={t('console.waitlist.notAllowed')} />;
  }
  return <Board venueId={staff.venue.venueId} canOpen={staff.venue.permissions.includes('floor.manage')} />;
}

/** A closed table's interest (#113): its own list, with the table to open. */
function interestOf(table: FloorTable, lists: readonly InterestList[], canOpen: boolean) {
  const list = lists.find((candidate) => candidate.tableId === table.id);
  // The floor's tables refresh first: once the table is open, it is running whatever the interest list last said.
  if (list === undefined || table.isOpen) return undefined;
  return { list, closedTable: table, canOpen };
}

function Board({ venueId, canOpen }: { venueId: string; canOpen: boolean }) {
  const tables = useFloorTables();
  const board = useWaitlistBoard(venueId);
  // The interest lists are an addition: the waitlists show while they load, or if they fail.
  const interest = useInterestLists(venueId).data ?? [];
  // So are the joins waiting for approval (#633), with an error above them when they fail to load.
  const asked = useWaitlistRequests(venueId);
  const requests = asked.data ?? [];
  const title = t('console.waitlist.title');
  const retry = () => void Promise.all([tables.refetch(), board.refetch()]);
  // Open all night: a list that stops refreshing stays on screen, saying since when.
  const isFailing = tables.isError || board.isError;
  if (tables.data === undefined || board.data === undefined) {
    return isFailing ? <Screen title={title} status="error" onRetry={retry} /> : <Screen title={title} status="loading" />;
  }
  // The selected venue's active tables, in floor order (staff read every venue they work at).
  const here = tables.data.filter((table) => table.venueId === venueId);
  if (here.length === 0) return <Screen title={title} status="empty" emptyText={t('console.waitlist.noGames')} />;
  return (
    <Screen title={title}>
      <Stack gap={10}>
        {isFailing ? <StaleNotice since={new Date(Math.min(tables.dataUpdatedAt, board.dataUpdatedAt))} onRetry={retry} /> : null}
        {asked.isError ? <ErrorMessage>{t('console.waitlist.requestsFailed')}</ErrorMessage> : null}
        {/* What Hold place and Remove each do (decision 0299: the owner asked). */}
        <Text tone="muted">{t('console.waitlist.holdOrRemove')}</Text>
        {here.map((table) => (
          <GameList key={table.id} venueId={venueId} table={table}
            entries={board.data.filter((entry) => entry.tableId === table.id)}
            requests={requests.filter((request) => request.tableId === table.id)}
            interest={interestOf(table, interest, canOpen)} />
        ))}
      </Stack>
    </Screen>
  );
}
