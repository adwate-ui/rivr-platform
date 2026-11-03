import { seatPlayerSchema } from '@rivr/contracts';
import { CALL_TIME_CHOICES } from '@rivr/domain/callTime';
import { seatingCallTime } from '@rivr/domain/tables';
import { openSeatsAt, useWaitlistBoard, type FloorTable, type HeldSeat, type SeatedPlayer, type WaitlistBoardEntry } from '@rivr/db';
import { formatDuration, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Input, Sheet, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { waitedSeconds } from './requestView.ts';
import { stakeOf } from './seatState.ts';
import type { SeatChanges, Seating } from './useSeatChanges.ts';

export interface SeatSheetProps {
  venueId: string;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  /** Where it opens: a table, and a seat there, or its first open one. */
  start: { readonly tableId: string; readonly seat: number | null };
  now: Date;
  changes: SeatChanges;
  onClose: () => void;
}

/** The next names on a table's own list (decision 0467), in order: waiting, not called, not away; four at most. */
function nextOn(board: readonly WaitlistBoardEntry[], tableId: string): WaitlistBoardEntry[] {
  return board.filter((entry) => entry.tableId === tableId && entry.callTableName === null && entry.awayUntil === null)
    .sort((a, b) => a.place - b.place).slice(0, 4);
}

/** Who is seated: the number typed, else the name chosen; or why neither will do. */
function seatingOf(number: string, entry: WaitlistBoardEntry | undefined): Seating | MessageKey {
  if (number.trim() !== '') {
    const parsed = seatPlayerSchema.safeParse({ number });
    return parsed.success ? { kind: 'number', who: parsed.data.number, typed: number.trim() } : 'console.floor.seat.badNumber';
  }
  if (entry === undefined) return 'console.floor.seat.chooseWho';
  return { kind: 'list', entryId: entry.entryId, memberId: entry.memberId, fullName: entry.fullName };
}

/** The sheet's choices: the table, its seat, who (a name from the list, or a number typed) and any call time chosen. */
function useSeatChoice(start: SeatSheetProps['start']) {
  const [tableId, setTableId] = useState(start.tableId);
  const [seat, setSeat] = useState<number | null>(start.seat);
  // A name chosen from the list; undefined takes the first on it, null none (a number is typed instead).
  const [entryId, setEntryId] = useState<string | null | undefined>(undefined);
  const [number, setNumber] = useState('');
  // A call time the floor chose; null takes the table's own (seatingCallTime), as the table changes.
  const [callMinutes, setCallMinutes] = useState<number | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  return { tableId, setTableId, seat, setSeat, entryId, setEntryId, number, setNumber, callMinutes, setCallMinutes, error, setError };
}

/** The seat chosen while it is still free, else the table's first free seat; none at a full table. */
function seatOf(free: readonly number[], chosen: number | null): number | null {
  return chosen !== null && free.includes(chosen) ? chosen : (free[0] ?? null);
}

/** The sheet's state and what follows from it: the table, its open seats, the names next on its list, and Seat. */
function useSeatSheet({ venueId, tables, seats, held, start, changes, onClose }: SeatSheetProps) {
  const board = useWaitlistBoard(venueId).data ?? [];
  const taken = [...seats, ...held];
  const choice = useSeatChoice(start);
  const table = tables.find((candidate) => candidate.id === choice.tableId);
  const callMinutes = choice.callMinutes ?? seatingCallTime(table?.callTimeMinutes ?? 0);
  const free = table === undefined ? [] : openSeatsAt(table, taken);
  const seat = seatOf(free, choice.seat);
  const next = nextOn(board, choice.tableId);
  const isTyped = choice.number.trim() !== '';
  const entry = choice.entryId === undefined ? next[0] : next.find((candidate) => candidate.entryId === choice.entryId);
  const confirm = async () => {
    const who = seatingOf(choice.number, isTyped ? undefined : entry);
    if (typeof who === 'string') return choice.setError(who);
    if (table === undefined || seat === null) return choice.setError('console.floor.seat.pickSeat');
    if (await changes.seat(who, { table, seat, callMinutes })) onClose();
  };
  const open = tables.filter((one) => one.isOpen && openSeatsAt(one, taken).length > 0);
  return { choice, table, free, seat, next, chosen: isTyped ? undefined : entry, open, confirm, callMinutes };
}

type SeatSheetState = ReturnType<typeof useSeatSheet>;

/** Who: the next names on the table's list, or a mobile or member number typed. */
function Who({ sheet, now }: { sheet: SeatSheetState; now: Date }) {
  const { choice, table, next, chosen } = sheet;
  const heading = t('console.floor.seat.nextOn', { table: table?.name ?? '' });
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{heading}</Text>
      {next.length === 0 ? <Text tone="muted">{t('console.floor.seat.nobody')}</Text> : (
        <ChoiceChips look="subtle" mode="one" label={heading} isLabelVisuallyHidden selected={chosen === undefined ? [] : [chosen.entryId]}
          options={next.map((one) => ({ value: one.entryId, label: t('console.floor.seat.waiting', { name: one.fullName, minutes: Math.floor(waitedSeconds(one.joinedAt, now) / 60) }) }))}
          onChange={([value]) => { choice.setEntryId(value ?? null); choice.setNumber(''); choice.setError(null); }} />
      )}
      <Input label={t('console.floor.seat.number')} value={choice.number} inputMode="numeric" autoComplete="off"
        onChange={(event) => { choice.setNumber(event.target.value); choice.setError(null); }} />
    </Stack>
  );
}

/** Where: an open table with a free seat, then the seat. */
function Where({ sheet }: { sheet: SeatSheetState }) {
  const { choice, open, free, seat } = sheet;
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{t('console.floor.seat.tableThenSeat')}</Text>
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.seat.table')} isLabelVisuallyHidden selected={[choice.tableId]}
        options={open.map((one) => ({ value: one.id, label: one.name }))}
        onChange={([value]) => { if (value !== undefined) { choice.setTableId(value); choice.setSeat(null); choice.setEntryId(undefined); } }} />
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.seat.seatNumber')} isLabelVisuallyHidden selected={seat === null ? [] : [String(seat)]}
        options={free.map((one) => ({ value: String(one), label: String(one) }))} onChange={([value]) => choice.setSeat(value === undefined ? null : Number(value))} />
    </Stack>
  );
}

/** For how long: 3, 4 or 5 hours (decision 0299), the stake's own chosen first. */
function CallTime({ sheet }: { sheet: SeatSheetState }) {
  const { choice, callMinutes } = sheet;
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{t('console.floor.seat.callTime')}</Text>
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.seat.callTime')} isLabelVisuallyHidden selected={[String(callMinutes)]}
        options={CALL_TIME_CHOICES.map((minutes) => ({ value: String(minutes), label: formatDuration(minutes * 60) }))}
        onChange={([value]) => { if (value !== undefined) choice.setCallMinutes(Number(value)); }} />
    </Stack>
  );
}

/**
 * Seat a player (console v3): the next names on the table's own list, or a mobile or member number; then the table and
 * seat; then the call time. Seat seats them at once, with Undo (decision 0480).
 */
export function SeatSheet(props: SeatSheetProps) {
  const sheet = useSeatSheet(props);
  const { table, seat } = sheet;
  const footer = (
    <>
      <Button variant="text" onClick={props.onClose}>{t('console.floor.seat.cancel')}</Button>
      <Button variant="primary" onClick={() => void sheet.confirm()}>{t('console.floor.seat.confirm')}</Button>
    </>
  );
  return (
    <Sheet place="console" isOpen onClose={props.onClose} title={t('console.floor.seat.title')} footer={footer}
      subtitle={table === undefined ? undefined : t('console.floor.seat.subtitle', { table: table.name, seat: seat ?? '', stake: stakeOf(table) })}>
      <Who sheet={sheet} now={props.now} />
      <Where sheet={sheet} />
      <CallTime sheet={sheet} />
      {sheet.choice.error === null ? null : <ErrorMessage>{t(sheet.choice.error)}</ErrorMessage>}
    </Sheet>
  );
}
