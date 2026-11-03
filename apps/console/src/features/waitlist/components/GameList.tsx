import type { FloorTable, InterestList, WaitlistBoardEntry, WaitlistRequest } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Heading, Inline, Stack, Stakes, Text } from '@rivr/ui';
import { AddMemberForm } from './AddMemberForm.tsx';
import { EntryRow } from './EntryRow.tsx';
import { InterestNotice } from './InterestNotice.tsx';
import { RequestList } from './RequestList.tsx';

interface GameListProps {
  venueId: string;
  /** The table whose list this is (decision 0433): a place is assigned only to it, while it is open. */
  table: FloorTable;
  entries: readonly WaitlistBoardEntry[];
  /** Joins from the app waiting for the floor (#633). */
  requests: readonly WaitlistRequest[];
  /** The table's interest while it is closed (#113): with the table to open, for staff who open tables. */
  interest?: { list: InterestList; closedTable: FloorTable | undefined; canOpen: boolean } | undefined;
}

/**
 * Whether a stake's name already says its blinds, as "NLH 50/100" or "NLH 1000/2000" does, written with the grouping
 * commas or without: then they show only once (UI polish audit A-10).
 */
export function nameGivesBlinds(name: string, smallBlind: bigint, bigBlind: bigint): boolean {
  const plain = (text: string) => text.replaceAll(',', '');
  return plain(name).includes(plain(formatStakes(smallBlind, bigBlind)));
}

/**
 * One table's list (decision 0433), in order, each place with the floor's actions, the joins waiting for approval (#633), and
 * a way to add a member by their number.
 */
export function GameList({ venueId, table, entries, requests, interest }: GameListProps) {
  // Assigned only to the list's own table, and only while it is open.
  const tables = table.isOpen ? [table] : [];
  return (
    <Stack gap={4}>
      <Inline gap={3} align="baseline">
        <Heading level={2}>{table.name}</Heading>
        <Text tone="muted">{table.tableTypeName}</Text>
        {nameGivesBlinds(table.tableTypeName, table.smallBlind, table.bigBlind) ? null : <Stakes smallBlind={table.smallBlind} bigBlind={table.bigBlind} tone="muted" />}
      </Inline>
      {interest === undefined ? null : (
        <InterestNotice venueId={venueId} interest={interest.list} table={interest.closedTable} canOpen={interest.canOpen} />
      )}
      <RequestList venueId={venueId} requests={requests} />
      {entries.length === 0 ? <Text tone="muted">{t('console.waitlist.empty')}</Text> : null}
      <Stack gap={3} divided>
        {entries.map((entry) => <EntryRow key={entry.entryId} venueId={venueId} entry={entry} tables={tables} />)}
      </Stack>
      <AddMemberForm venueId={venueId} tableId={table.id} />
    </Stack>
  );
}
