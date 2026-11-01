import type { FloorTable, InterestList, WaitlistBoardEntry, WaitlistRequest } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Heading, Inline, Stack, Stakes, Text } from '@rivr/ui';
import { AddMemberForm } from './AddMemberForm.tsx';
import { EntryRow } from './EntryRow.tsx';
import { InterestNotice } from './InterestNotice.tsx';
import { RequestList } from './RequestList.tsx';

interface GameListProps {
  venueId: string;
  game: FloorTable;
  /** The game's open tables, to call a member to. */
  tables: readonly FloorTable[];
  entries: readonly WaitlistBoardEntry[];
  /** Joins from the app waiting for the floor (#633). */
  requests: readonly WaitlistRequest[];
  /** The game's interest while it is not running (#113): with a closed table to open, for staff who open tables. */
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
 * One game and stake's list, in order, each place with the floor's actions, the joins waiting for approval (#633), and a way
 * to add a member by their number.
 */
export function GameList({ venueId, game, tables, entries, requests, interest }: GameListProps) {
  return (
    <Stack gap={4}>
      <Inline gap={3} align="baseline">
        <Heading level={2}>{game.tableTypeName}</Heading>
        {nameGivesBlinds(game.tableTypeName, game.smallBlind, game.bigBlind) ? null : <Stakes smallBlind={game.smallBlind} bigBlind={game.bigBlind} tone="muted" />}
      </Inline>
      {interest === undefined ? null : (
        <InterestNotice venueId={venueId} interest={interest.list} table={interest.closedTable} canOpen={interest.canOpen} />
      )}
      <RequestList venueId={venueId} requests={requests} />
      {entries.length === 0 ? <Text tone="muted">{t('console.waitlist.empty')}</Text> : null}
      <Stack gap={3} divided>
        {entries.map((entry) => <EntryRow key={entry.entryId} venueId={venueId} entry={entry} tables={tables} />)}
      </Stack>
      <AddMemberForm venueId={venueId} tableTypeId={game.tableTypeId} />
    </Stack>
  );
}
