import { bonusChipsToRedeemSchema, seatPlayerSchema } from '@rivr/contracts';
import { isCallTimeMinutes } from '@rivr/domain/callTime';
import {
  openSeatsAt, useMemberSearch, useWaitlistBoard, type FloorTable, type HeldSeat, type MemberRow, type SeatedPlayer, type WaitlistBoardEntry,
} from '@rivr/db';
import { useMemberBonus, useMemberBonusVisitLeft } from '@rivr/db/bonus';
import { formatChips, t, type MessageKey } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Input, Sheet, Stack, Text, UnitInput } from '@rivr/ui';
import { useState } from 'react';
import { waitedSeconds } from './requestView.ts';
import { stakeOf } from './seatState.ts';
import type { SeatChanges, Seating } from './useSeatChanges.ts';

export interface SeatSheetProps {
  venueId: string;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  /** Where it opens: a table, and a seat there, or its first open one; and who, a place on its list, or its first. */
  start: { readonly tableId: string; readonly seat: number | null; readonly entryId?: string | undefined };
  now: Date;
  changes: SeatChanges;
  /** Opens the check in person for a member on the list whose identity check is not done (decision 0503); none for staff who may not check. */
  onCheckId?: ((fullName: string) => void) | undefined;
  onClose: () => void;
}

/**
 * The next names on a table's own list (decision 0467), in order: waiting, not called, not away; four at most, and the
 * place the sheet opened for (`pinned`) wherever it is on the list.
 */
function nextOn(board: readonly WaitlistBoardEntry[], tableId: string, pinned: string | undefined): WaitlistBoardEntry[] {
  return board.filter((entry) => entry.tableId === tableId && (entry.entryId === pinned || (entry.callTableName === null && entry.awayUntil === null)))
    .sort((a, b) => a.place - b.place).filter((entry, index) => index < 4 || entry.entryId === pinned);
}

/** The members suggested as the floor types: a few at most (the owner, 15 Nov night). */
const MATCHES_MOST = 8;

/** Who is seated: the member chosen from those matching what is typed, else the number typed, else the name chosen; or why none will do. */
function seatingOf(number: string, entry: WaitlistBoardEntry | undefined, match: MemberRow | null): Seating | MessageKey {
  if (match !== null) {
    const parsed = seatPlayerSchema.safeParse({ number: String(match.memberNumber) });
    return parsed.success ? { kind: 'number', who: parsed.data.number, typed: match.fullName } : 'console.floor.seat.badNumber';
  }
  if (number.trim() !== '') {
    const parsed = seatPlayerSchema.safeParse({ number });
    if (parsed.success) return { kind: 'number', who: parsed.data.number, typed: number.trim() };
    // A name, or part of one: the member is chosen from those it matches.
    return /\p{L}/u.test(number) ? 'console.floor.seat.chooseMatch' : 'console.floor.seat.badNumber';
  }
  if (entry === undefined) return 'console.floor.seat.chooseWho';
  // Not checked yet (decision 0503): the database refuses the seat, so the sheet says the desk comes first.
  if (entry.needsIdCheck) return 'console.liveFloor.kycNeeded';
  return { kind: 'list', entryId: entry.entryId, memberId: entry.memberId, fullName: entry.fullName };
}

/** The sheet's choices: the table, its seat, who (a name from the list, or one matching what is typed, or a number) and any call time chosen. */
function useSeatChoice(start: SeatSheetProps['start']) {
  const [tableId, setTableId] = useState(start.tableId);
  const [seat, setSeat] = useState<number | null>(start.seat);
  // A name chosen from the list, at first the one the sheet opened for; undefined takes the first on it, null none (a number
  // is typed instead).
  const [entryId, setEntryId] = useState<string | null | undefined>(start.entryId);
  const [number, setNumber] = useState('');
  // The member chosen from those matching what is typed; null while none is.
  const [match, setMatch] = useState<MemberRow | null>(null);
  // A call time the floor typed; undefined takes the stake's own, as the table changes; null is a field left blank or
  // holding a time it refuses.
  const [callMinutes, setCallMinutes] = useState<number | null | undefined>(undefined);
  // Bonus chips the member redeems with their buy-in (decision 0504), as typed; blank is none.
  const [bonusChips, setBonusChips] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  return {
    tableId, setTableId, seat, setSeat, entryId, setEntryId, number, setNumber, match, setMatch, callMinutes, setCallMinutes, bonusChips, setBonusChips,
    error, setError,
  };
}

/** The members matching what is typed, by name, member number or the mobile's last digits, through the bounded member search. */
function useMatches(venueId: string, typed: string): readonly MemberRow[] {
  const found = useMemberSearch(venueId, typed);
  return typed.trim() === '' ? [] : (found.data ?? []).slice(0, MATCHES_MOST);
}

/** Whose bonus the sheet shows: the member chosen from the matches while something is typed, else the one chosen from the list. */
const bonusMemberOf = (isTyped: boolean, match: MemberRow | null, entry: WaitlistBoardEntry | undefined) =>
  (isTyped ? (match?.memberId ?? null) : (entry?.memberId ?? null));

/** The seat chosen while it is still free, else the table's first free seat; none at a full table. */
function seatOf(free: readonly number[], chosen: number | null): number | null {
  return chosen !== null && free.includes(chosen) ? chosen : (free[0] ?? null);
}

/** The sheet's state and what follows from it: the table, its open seats, the names next on its list, and Seat. */
function useSeatSheet({ venueId, tables, seats, held, start, changes, onClose }: SeatSheetProps) {
  const board = useWaitlistBoard(venueId).data ?? [];
  // The seat held for the member the sheet opened for is theirs to take.
  const taken = [...seats, ...held.filter((one) => one.entryId !== start.entryId)];
  const choice = useSeatChoice(start);
  const table = tables.find((candidate) => candidate.id === choice.tableId);
  const tablesOwn = table?.callTimeMinutes ?? 0;
  const callMinutes = choice.callMinutes === undefined ? tablesOwn : choice.callMinutes;
  const free = table === undefined ? [] : openSeatsAt(table, taken);
  const seat = seatOf(free, choice.seat);
  const next = nextOn(board, choice.tableId, start.entryId);
  const isTyped = choice.number.trim() !== '';
  const entry = choice.entryId === undefined ? next[0] : next.find((candidate) => candidate.entryId === choice.entryId);
  const matches = useMatches(venueId, choice.number);
  // Busy from the press until the answer: a second press would ask again (the trial run: seventeen in eight seconds).
  const [isSeating, setSeating] = useState(false);
  const confirm = async () => {
    if (isSeating) return undefined;
    const who = seatingOf(choice.number, isTyped ? undefined : entry, choice.match);
    if (typeof who === 'string') return choice.setError(who);
    if (table === undefined || seat === null) return choice.setError('console.floor.seat.pickSeat');
    if (!isCallTimeMinutes(callMinutes)) return choice.setError('console.floor.seat.badCallTime');
    const bonusChips = bonusChipsToRedeemSchema.safeParse(choice.bonusChips);
    if (!bonusChips.success) return choice.setError('console.floor.seat.badBonusChips');
    setSeating(true);
    try {
      if (await changes.seat(who, { table, seat, callMinutes, bonusChips: bonusChips.data })) onClose();
    } finally {
      setSeating(false);
    }
    return undefined;
  };
  const open = tables.filter((one) => one.isOpen && openSeatsAt(one, taken).length > 0);
  return {
    choice, table, free, seat, next, chosen: isTyped ? undefined : entry, matches, bonusMemberId: bonusMemberOf(isTyped, choice.match, entry), open, confirm,
    isSeating, callMinutes, tablesOwn,
  };
}

type SeatSheetState = ReturnType<typeof useSeatSheet>;

/**
 * Who: the next names on the table's list, or a name, mobile or member number typed, with the members it matches to choose
 * from by a tap or the arrow keys (the owner, 15 Nov night).
 */
function Who({ sheet, now }: { sheet: SeatSheetState; now: Date }) {
  const { choice, table, next, chosen, matches } = sheet;
  const heading = t('console.floor.seat.nextOn', { table: table?.name ?? '' });
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{heading}</Text>
      {next.length === 0 ? <Text tone="muted">{t('console.floor.seat.nobody')}</Text> : (
        <ChoiceChips look="subtle" mode="one" label={heading} isLabelVisuallyHidden selected={chosen === undefined ? [] : [chosen.entryId]}
          options={next.map((one) => ({ value: one.entryId, label: t('console.floor.seat.waiting', { name: one.fullName, minutes: Math.floor(waitedSeconds(one.joinedAt, now) / 60) }) }))}
          onChange={([value]) => { choice.setEntryId(value ?? null); choice.setNumber(''); choice.setMatch(null); choice.setError(null); }} />
      )}
      <Input label={t(next.length === 0 ? 'console.floor.seat.numberAlone' : 'console.floor.seat.number')} value={choice.number} inputMode="numeric" autoComplete="off"
        onChange={(event) => { choice.setNumber(event.target.value); choice.setMatch(null); choice.setError(null); }} />
      {matches.length === 0 ? null : (
        <ChoiceChips look="subtle" mode="one" label={t('console.floor.seat.matches')} isLabelVisuallyHidden selected={choice.match === null ? [] : [choice.match.memberId]}
          options={matches.map((row) => ({ value: row.memberId, label: t('console.floor.seat.match', { name: row.fullName, number: row.memberNumber }) }))}
          onChange={([value]) => { choice.setMatch(matches.find((row) => row.memberId === value) ?? null); choice.setEntryId(null); choice.setError(null); }} />
      )}
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
        onChange={([value]) => { if (value !== undefined) { choice.setTableId(value); choice.setSeat(null); choice.setEntryId(undefined); choice.setCallMinutes(undefined); } }} />
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.seat.seatNumber')} isLabelVisuallyHidden selected={seat === null ? [] : [String(seat)]}
        options={free.map((one) => ({ value: String(one), label: String(one) }))} onChange={([value]) => choice.setSeat(value === undefined ? null : Number(value))} />
    </Stack>
  );
}

/**
 * For how long (redesign RD-19): typed, in minutes, starting from the stake's own at the table chosen; the Waitlist's sheet
 * has the same field (audit F-112).
 */
function CallTime({ sheet }: { sheet: SeatSheetState }) {
  const { choice, tablesOwn } = sheet;
  return <UnitInput key={choice.tableId} label={t('console.floor.seat.callTime')} unit="minutes" min={0} max={1440} initialValue={tablesOwn} hint={t('console.floor.seat.callTimeHint')} onChange={choice.setCallMinutes} />;
}

/** The member's bonus chips under the field: their balance, and what this visit may still redeem where the club caps it (decision 0579). */
function bonusHint(balance: bigint | null | undefined, left: bigint | null | undefined): string | undefined {
  if (balance === undefined || balance === null) return undefined;
  if (balance === 0n) return t('console.floor.seat.bonusChipsNone');
  if (left === undefined || left === null) return t('console.floor.seat.bonusChipsHas', { chips: formatChips(balance) });
  return t('console.floor.seat.bonusChipsLeft', { chips: formatChips(balance), left: formatChips(left) });
}

/**
 * Bonus chips the member redeems with their buy-in (decision 0504): their balance once a member is chosen, from the list or
 * from those matching what is typed, and what this visit may still redeem (decision 0579); a number typed is checked as they sit.
 */
function BonusChips({ sheet, venueId }: { sheet: SeatSheetState; venueId: string }) {
  const { choice, bonusMemberId } = sheet;
  const balance = useMemberBonus(venueId, bonusMemberId).data;
  const left = useMemberBonusVisitLeft(venueId, bonusMemberId).data;
  const hint = bonusMemberId === null ? t('console.floor.seat.bonusChipsTyped') : bonusHint(balance, left);
  return (
    <Input label={t('console.floor.seat.bonusChips')} hint={hint} value={choice.bonusChips} inputMode="numeric" autoComplete="off"
      onChange={(event) => { choice.setBonusChips(event.target.value); choice.setError(null); }} />
  );
}

/**
 * Seat a player (console v3): the next names on the table's own list, or a member found by name, mobile or member number; then the table and
 * seat; then the call time; then any bonus chips they redeem with their buy-in (decision 0504). Seat seats them at once,
 * with Undo (decision 0480) unless bonus chips were redeemed.
 */
export function SeatSheet(props: SeatSheetProps) {
  const sheet = useSeatSheet(props);
  const { table, seat, chosen } = sheet;
  const { onCheckId } = props;
  // A member on the list not checked yet goes to the desk first: Check ID in place of Seat, for staff who may check.
  const toCheck = chosen?.needsIdCheck === true && onCheckId !== undefined ? chosen : undefined;
  const footer = (
    <>
      <Button variant="text" onClick={props.onClose}>{t('console.floor.seat.cancel')}</Button>
      {toCheck === undefined
        ? <Button variant="primary" isLoading={sheet.isSeating} onClick={() => void sheet.confirm()}>{t('console.floor.seat.confirm')}</Button>
        : <Button variant="primary" aria-label={t('console.waitlist.checkId', { name: toCheck.fullName })} onClick={() => onCheckId?.(toCheck.fullName)}>{t('console.waitlist.checkIdShort')}</Button>}
    </>
  );
  return (
    <Sheet place="console" isOpen onClose={props.onClose} title={t('console.floor.seat.title')} footer={footer}
      subtitle={table === undefined ? undefined : t('console.floor.seat.subtitle', { table: table.name, seat: seat ?? '', stake: stakeOf(table) })}>
      <Who sheet={sheet} now={props.now} />
      <Where sheet={sheet} />
      <CallTime sheet={sheet} />
      <BonusChips sheet={sheet} venueId={props.venueId} />
      {sheet.choice.error === null ? null : <ErrorMessage>{t(sheet.choice.error)}</ErrorMessage>}
    </Sheet>
  );
}
