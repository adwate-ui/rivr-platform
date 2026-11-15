import { LIST_PAGE, useListChoices, useWaitlistPage, type FloorTable, type WaitlistBoardEntry } from '@rivr/db';
import { tableWithRoomFor } from '@rivr/domain/tables';
import { formatDuration, t, type MessageKey } from '@rivr/i18n';
import { Box, DataTable, ErrorMessage, StaleNotice, Stack, Text, type DataTableColumn, type DataTableRequest } from '@rivr/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { BulkPlaces } from './BulkPlaces.tsx';
import { PlaceActions, PlaceQuestion, type Asking } from './PlaceActions.tsx';
import { isLatePlace, placeNotes, stakeOf, waitedSeconds } from './placeMeta.ts';

/** The time the wait times count to, moved on each half minute. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(new Date()), 30_000);
    return () => globalThis.clearInterval(timer);
  }, []);
  return now;
}

interface WaitlistTableProps {
  venueId: string;
  /** The venue's tables: a place's own, by its id, and where else its stake has room (audit F-036). */
  tables: readonly FloorTable[];
  onSeat: (entry: WaitlistBoardEntry, table: FloorTable) => void;
  /** Opens the check in person for a place whose member's identity check waits for the desk (decision 0503); none for staff who cannot. */
  onCheckId?: ((entry: WaitlistBoardEntry) => void) | undefined;
}

/** What a place's row needs beside the place: its table, the time, and the row's steps. */
interface RowContext {
  readonly now: Date;
  readonly tableOf: (entry: WaitlistBoardEntry) => FloorTable | undefined;
  readonly notesOf: (entry: WaitlistBoardEntry) => string;
  readonly steps: (entry: WaitlistBoardEntry) => ReactNode;
  readonly tableChoices: readonly { readonly value: string; readonly count: number }[];
}

/** How long a place has waited, in red and saying so once it is late (audit F-075). */
function Waited({ entry, now, isTableOpen }: { entry: WaitlistBoardEntry; now: Date; isTableOpen: boolean }) {
  const age = formatDuration(waitedSeconds(entry, now));
  return isLatePlace(entry, now, isTableOpen)
    ? <Text as="span" variant="row" tone="danger">{t('console.waitlist.card.late', { age })}</Text>
    : <Text as="span" variant="row" tone="muted">{age}</Text>;
}

/** A place's table with its stake: "Table 2 · NLH 100/200". */
const tableLine = (table: FloorTable | undefined) => (table === undefined ? '' : t('console.waitlist.table.tableLine', { table: table.name, stake: stakeOf(table) }));

/**
 * The Waitlist's columns (redesign RD-31): the place's number on its own table's list, the player, the table, how long
 * they have waited, what to know (their ID check, a call, why they are ahead, a place held, room elsewhere), and the
 * row's steps. The server sorts and filters, so each column says its kind of filter; Table's menu holds its counts.
 */
function columnsFor({ now, tableOf, notesOf, steps, tableChoices }: RowContext): readonly DataTableColumn<WaitlistBoardEntry>[] {
  return [
    { key: 'place', header: t('console.waitlist.table.place'), priority: 'secondary', sortValue: (entry) => entry.place, filter: false, cell: (entry) => <Text as="span" variant="row" tone="muted">{String(entry.place)}</Text> },
    { key: 'player', header: t('console.waitlist.table.player'), priority: 'primary', isWide: true, sortValue: (entry) => entry.fullName, filter: 'text', cell: (entry) => entry.fullName },
    { key: 'table', header: t('console.waitlist.table.table'), sortValue: (entry) => tableOf(entry)?.name ?? '', filter: 'choice', choices: tableChoices,
      filterValue: (entry) => tableOf(entry)?.name ?? '', cell: (entry) => tableLine(tableOf(entry)), isWide: true },
    { key: 'waited', header: t('console.waitlist.table.waited'), sortValue: (entry) => waitedSeconds(entry, now), filter: 'duration',
      cell: (entry) => <Waited entry={entry} now={now} isTableOpen={tableOf(entry)?.isOpen ?? true} />, exportValue: (entry) => formatDuration(waitedSeconds(entry, now)) },
    { key: 'notes', header: t('console.waitlist.table.notes'), isWide: true, filter: false, cell: notesOf },
    // Two shares, so Seat, Call and the menu stay on one line.
    { key: 'steps', header: '', align: 'end', isWide: true, filter: false, cell: steps },
  ];
}

/** What opened under the rows: the one question being asked, and each row's last failure. */
function useRowNotes() {
  const [asking, setAsking] = useState<{ entryId: string; what: Asking } | null>(null);
  const [failures, setFailures] = useState<Readonly<Record<string, MessageKey>>>({});
  const report = (entryId: string, failure: MessageKey | null) => setFailures((before) => {
    const { [entryId]: _gone, ...rest } = before;
    return failure === null ? rest : { ...rest, [entryId]: failure };
  });
  return { asking, failures, report, ask: (entryId: string, what: Asking) => setAsking({ entryId, what }), answered: () => setAsking(null) };
}

type RowNotes = ReturnType<typeof useRowNotes>;

/** Whether a place's row has something open under it: its question, or its last failure. */
const hasDetail = (notes: RowNotes, entry: WaitlistBoardEntry) => notes.asking?.entryId === entry.entryId || notes.failures[entry.entryId] !== undefined;

/** Under a place's row: the question its step asks first, and why its last step failed. */
function PlaceDetail({ venueId, entry, notes }: { venueId: string; entry: WaitlistBoardEntry; notes: RowNotes }) {
  const failure = notes.failures[entry.entryId];
  const isAsked = notes.asking?.entryId === entry.entryId;
  return (
    <Stack gap={2}>
      {isAsked && notes.asking !== null ? (
        <PlaceQuestion venueId={venueId} entry={entry} asking={notes.asking.what} onDone={notes.answered} onOutcome={(outcome) => notes.report(entry.entryId, outcome)} />
      ) : null}
      {failure === undefined ? null : <Box paddingX={4}><ErrorMessage>{t(failure)}</ErrorMessage></Box>}
    </Stack>
  );
}

/** What each row is drawn with: its table, its notes, and its steps. */
function useRowContext({ venueId, tables, onSeat, onCheckId }: WaitlistTableProps, notes: RowNotes, tableChoices: RowContext['tableChoices']): RowContext {
  const now = useNow();
  const tableOf = (entry: WaitlistBoardEntry) => tables.find((table) => table.id === entry.tableId);
  return {
    now, tableOf, tableChoices,
    notesOf: (entry) => {
      const table = tableOf(entry);
      return placeNotes(entry, { roomAt: table === undefined ? null : tableWithRoomFor(table, tables), hasOwnCheck: onCheckId !== undefined });
    },
    steps: (entry) => {
      const table = tableOf(entry);
      if (table === undefined) return null;
      return <PlaceActions venueId={venueId} entry={entry} table={table} onSeat={() => onSeat(entry, table)}
        onCheckId={onCheckId === undefined ? undefined : () => onCheckId(entry)} onAsk={(what) => notes.ask(entry.entryId, what)}
        onOutcome={(failure) => notes.report(entry.entryId, failure)} />;
    },
  };
}

/** The table's rows, or that they are loading or did not load. */
function stateOf(page: ReturnType<typeof useWaitlistPage>) {
  if (page.data !== undefined) return { rows: page.data.rows, emptyText: t('console.waitlist.empty') };
  return page.isError ? { status: 'error' as const, onRetry: () => void page.refetch() } : { status: 'loading' as const };
}

/**
 * Every place on every table's list as one table, a page at a time from the server (redesign RD-31; the owner, 15 Nov),
 * table by table in each list's own order. A row carries what a place's row always did: its tick for the bulk bar, Seat
 * or Check ID, Call, and the menu to hold, release or remove it; a question or a failure opens under the row.
 */
export function WaitlistTable(props: WaitlistTableProps) {
  const { venueId } = props;
  const [request, setRequest] = useState<DataTableRequest | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const notes = useRowNotes();
  const page = useWaitlistPage(venueId, request);
  const counted = useListChoices('waitlist', venueId, request).data;
  const context = useRowContext(props, notes, counted?.['table'] ?? []);
  const search = { label: t('console.waitlist.table.search'), variant: 'subtle' as const, text: (entry: WaitlistBoardEntry) => entry.fullName };
  // A place seated or removed since is no longer ticked.
  const ticked = (page.data?.rows ?? []).filter((entry) => selected.includes(entry.entryId));
  return (
    <Stack gap={3}>
      {page.isError && page.data !== undefined ? <StaleNotice since={new Date(page.dataUpdatedAt)} onRetry={() => void page.refetch()} /> : null}
      <BulkPlaces venueId={venueId} entries={ticked} onClear={() => setSelected([])} />
      <DataTable {...stateOf(page)} label={t('console.waitlist.table.label')} columns={columnsFor(context)} rowKey={(entry) => entry.entryId} filter={search}
        selection={{ selected, onChange: setSelected }} rowDetail={(entry) => (hasDetail(notes, entry) ? <PlaceDetail venueId={venueId} entry={entry} notes={notes} /> : null)}
        server={{ total: page.data?.total ?? 0, pageSize: LIST_PAGE, onRequest: setRequest }} exportRows={page.readEvery} />
    </Stack>
  );
}
