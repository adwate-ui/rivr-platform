import {
  useFloorTables, useInterestLists, useWaitlistBoard, useWaitlistRequests, type FloorTable, type InterestList, type WaitlistBoardEntry, type WaitlistRequest,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, Grid, LoadState, Skeleton, StaleNotice, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { BulkPlaces } from './BulkPlaces.tsx';
import { SeatSheet, type SeatSheetPlace } from './SeatSheet.tsx';
import { TableWaitlist } from './TableWaitlist.tsx';

/** The time the wait times count to, moved on each half minute. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), 30_000);
    return () => globalThis.clearInterval(timer);
  }, []);
  return now;
}

/** The ticked places, by entry: ticked and unticked one at a time, cleared all at once. */
function useTicks() {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const toggle = (entryId: string) => setTicked((before) => {
    const after = new Set(before);
    if (after.has(entryId)) after.delete(entryId);
    else after.add(entryId);
    return after;
  });
  return { ticked, toggle, clear: () => setTicked(new Set()) };
}

/**
 * The tables with a card (decision 0467): every open one, and a closed one only while someone waits on it or asks to,
 * as its interest in reopening (#113). Inactive tables never come (decision 0466).
 */
function tablesShown(tables: readonly FloorTable[], venueId: string, board: readonly WaitlistBoardEntry[], askedAt: ReadonlySet<string>) {
  return tables.filter((table) => table.venueId === venueId && (table.isOpen || askedAt.has(table.id) || board.some((entry) => entry.tableId === table.id)));
}

interface CardsProps {
  venueId: string;
  canOpen: boolean;
  tables: readonly FloorTable[];
  entries: readonly WaitlistBoardEntry[];
  requests: readonly WaitlistRequest[];
  interest: readonly InterestList[];
}

/** The cards once the tables and lists have come, the bulk bar over the places ticked, and the seat sheet. */
function Cards({ venueId, canOpen, tables, entries, requests, interest }: CardsProps) {
  const now = useNow();
  const ticks = useTicks();
  const navigate = useNavigate();
  const [seating, setSeating] = useState<{ table: FloorTable; place: SeatSheetPlace } | null>(null);
  // Check ID (decision 0503): the check in person, with the member searched by name; Seat comes back once they are verified.
  const checkId = (entry: WaitlistBoardEntry) => void navigate({ to: '/kyc-review', search: { check: entry.fullName } });
  const shown = tablesShown(tables, venueId, entries, new Set(requests.map((request) => request.tableId)));
  if (shown.length === 0) return <Text tone="muted">{t('console.waitlist.noGames')}</Text>;
  return (
    <>
      <BulkPlaces venueId={venueId} entries={entries.filter((entry) => ticks.ticked.has(entry.entryId))} onClear={ticks.clear} />
      <Grid columns="cards" gap={4}>
        {shown.map((table) => (
          <TableWaitlist key={table.id} venueId={venueId} table={table} now={now} canOpen={canOpen}
            entries={entries.filter((entry) => entry.tableId === table.id)}
            requests={requests.filter((request) => request.tableId === table.id)}
            interest={table.isOpen ? undefined : interest.find((list) => list.tableId === table.id)}
            ticked={ticks.ticked} onToggle={ticks.toggle}
            onSeat={(entry) => setSeating({ table, place: { entryId: entry.entryId, name: entry.fullName } })} onCheckId={checkId} />
        ))}
      </Grid>
      {seating === null ? null : <SeatSheet venueId={venueId} table={seating.table} place={seating.place} onClose={() => setSeating(null)} />}
    </>
  );
}

/**
 * Lists, the Waitlist screen's first tab (console v3): a card for each table's own list (decision 0467), the bulk bar over
 * the places ticked, and the sheet that seats a place at its table. Open all night: a list that stops refreshing stays on
 * screen, saying since when.
 */
export function WaitlistLists({ venueId, canOpen }: { venueId: string; canOpen: boolean }) {
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
      <Cards venueId={venueId} canOpen={canOpen} tables={tables.data} entries={board.data} requests={asked.data ?? []} interest={interest} />
    </Stack>
  );
}
