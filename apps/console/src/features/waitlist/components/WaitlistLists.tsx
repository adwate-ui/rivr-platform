import {
  useFloorTables, useInterestLists, useReadyToSeat, useWaitlistBoard, useWaitlistRequests, type FloorTable, type InterestList,
  type WaitlistBoardEntry, type WaitlistRequest,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Grid, LoadState, Skeleton, StaleNotice, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AddPlaceForm } from './AddPlaceForm.tsx';
import { SeatSheet, type SeatSheetPlace } from './SeatSheet.tsx';
import { isFullWithWaiting, TableWaitlist } from './TableWaitlist.tsx';
import { WaitlistTable } from './WaitlistTable.tsx';

/**
 * The tables with a list (decision 0467): every open one, and a closed one only while someone waits on it or asks to,
 * as its interest in reopening (#113). Inactive tables never come (decision 0466).
 */
function tablesShown(tables: readonly FloorTable[], venueId: string, board: readonly WaitlistBoardEntry[], askedAt: ReadonlySet<string>) {
  return tables.filter((table) => table.venueId === venueId && (table.isOpen || askedAt.has(table.id) || board.some((entry) => entry.tableId === table.id)));
}

interface CardsProps {
  venueId: string;
  canOpen: boolean;
  /** Check ID opens KYC review, which only staff who check members in person may open (audit F-014). */
  canCheckId: boolean;
  tables: readonly FloorTable[];
  entries: readonly WaitlistBoardEntry[];
  requests: readonly WaitlistRequest[];
  interest: readonly InterestList[];
}

/** What one table has of its own to say: its joins asking, a closed table's interest, or that it is full while members wait. Null with none. */
function cardOf(table: FloorTable, { entries, requests, interest }: Pick<CardsProps, 'entries' | 'requests' | 'interest'>) {
  const waiting = entries.filter((entry) => entry.tableId === table.id).length;
  const asking = requests.filter((request) => request.tableId === table.id);
  const interested = table.isOpen ? undefined : interest.find((list) => list.tableId === table.id);
  const hasOwn = asking.length > 0 || interested !== undefined || isFullWithWaiting(table, waiting);
  return hasOwn ? { table, waiting, asking, interested } : null;
}

/** Once the tables and lists have come: a card for each table with something of its own to say, every place as one table, and the seat sheet. */
function Cards({ venueId, canOpen, canCheckId, tables, entries, requests, interest }: CardsProps) {
  const navigate = useNavigate();
  const [seating, setSeating] = useState<{ table: FloorTable; place: SeatSheetPlace } | null>(null);
  const readyToSeat = useReadyToSeat(venueId);
  // Approve leads on to the seat sheet when a seat is free for the place (the owner, 8 Nov), as on the Live floor.
  const onApproved = (entryId: string) => void readyToSeat(entryId).then((alert) => {
    const table = tables.find((one) => one.id === alert?.tableId);
    // Only while no sheet is open: one the floor opened meanwhile stays.
    if (alert !== null && table !== undefined) setSeating((open) => open ?? { table, place: { entryId, memberId: alert.memberId, name: alert.fullName } });
  });
  // Check ID (decision 0503): the check in person, with the member searched by name; Seat comes back once they are verified.
  const checkId = (entry: WaitlistBoardEntry) => void navigate({ to: '/kyc-review', search: { check: entry.fullName } });
  const shown = tablesShown(tables, venueId, entries, new Set(requests.map((request) => request.tableId)));
  if (shown.length === 0) return <Text tone="muted">{t('console.waitlist.noGames')}</Text>;
  const cards = shown.flatMap((table) => cardOf(table, { entries, requests, interest }) ?? []);
  return (
    <>
      {cards.length === 0 ? null : (
        <Grid columns="cards" gap={4}>
          {cards.map(({ table, waiting, asking, interested }) => (
            <TableWaitlist key={table.id} venueId={venueId} table={table} canOpen={canOpen} waiting={waiting} requests={asking} interest={interested} onApproved={onApproved} />
          ))}
        </Grid>
      )}
      <WaitlistTable venueId={venueId} tables={tables} onCheckId={canCheckId ? checkId : undefined}
        onSeat={(entry, table) => setSeating({ table, place: { entryId: entry.entryId, memberId: entry.memberId, name: entry.fullName } })} />
      {seating === null ? null : <SeatSheet venueId={venueId} table={seating.table} place={seating.place} onClose={() => setSeating(null)} />}
    </>
  );
}

/** Add to a list, for the Waitlist's title row: the tables with a list are its choices. */
export function AddToList({ venueId }: { venueId: string }) {
  const tables = useFloorTables().data ?? [];
  const board = useWaitlistBoard(venueId).data ?? [];
  const asked = useWaitlistRequests(venueId).data ?? [];
  return <AddPlaceForm venueId={venueId} tables={tablesShown(tables, venueId, board, new Set(asked.map((request) => request.tableId)))} />;
}

/**
 * Lists, the Waitlist screen's first tab (console v3; redesign RD-31): every place as one table from the server with the
 * table as a column (each table keeps its own list and order, decision 0467), the bulk bar over the places ticked, and the
 * sheet that seats a place at its table; over it, a card for each table with something of its own to say. Open all night: a list that stops refreshing stays on
 * screen, saying since when.
 */
export function WaitlistLists({ venueId, canOpen, canCheckId }: { venueId: string; canOpen: boolean; canCheckId: boolean }) {
  const tables = useFloorTables();
  const board = useWaitlistBoard(venueId);
  // The interest lists and the joins asking are additions: the lists show while they load, or if they fail.
  const interest = useInterestLists(venueId).data ?? [];
  const asked = useWaitlistRequests(venueId);
  const retry = () => void Promise.all([tables.refetch(), board.refetch()]);
  const isFailing = tables.isError || board.isError;
  if (tables.data === undefined || board.data === undefined) {
    return isFailing ? <LoadState isError onRetry={retry} /> : <Skeleton look="tiles" />;
  }
  return (
    <Stack gap={4}>
      {isFailing ? <StaleNotice since={new Date(Math.min(tables.dataUpdatedAt, board.dataUpdatedAt))} onRetry={retry} /> : null}
      {asked.isError ? <ErrorMessage>{t('console.waitlist.requestsFailed')}</ErrorMessage> : null}
      <Cards venueId={venueId} canOpen={canOpen} canCheckId={canCheckId} tables={tables.data} entries={board.data} requests={asked.data ?? []} interest={interest} />
    </Stack>
  );
}
