import type { Result } from '@rivr/contracts/result';
import { useCheckInActions, useCheckOutActions, useMemberSearch, type CheckInFailure, type CheckOutRefusal, type MemberRow } from '@rivr/db';
import { useState } from 'react';
import { doorQuery, type DoorQuery } from './doorQuery.ts';

/** In or out: what the front desk pressed. */
export type DoorAction = 'in' | 'out';

/** What the last press at the door did, or why it did nothing. */
export type DoorOutcome =
  | { readonly kind: 'checked_in' | 'checked_out' | 'unusable' | 'no_match' | 'card_out' }
  | { readonly kind: 'in_failed'; readonly failure: CheckInFailure }
  | { readonly kind: 'out_failed'; readonly refusal: CheckOutRefusal }
  | { readonly kind: 'several'; readonly action: DoorAction; readonly matches: readonly MemberRow[] };

const isDone = (outcome: DoorOutcome | null) => outcome?.kind === 'checked_in' || outcome?.kind === 'checked_out';

const admitted = (result: Result<string, CheckInFailure>): DoorOutcome =>
  (result.ok ? { kind: 'checked_in' } : { kind: 'in_failed', failure: result.error });
const released = (result: Result<string, CheckOutRefusal>): DoorOutcome =>
  (result.ok ? { kind: 'checked_out' } : { kind: 'out_failed', refusal: result.error });

/** The door's calls, each answering with what it did. */
function useDoorCalls(venueId: string) {
  const { checkIn, checkInByCard, checkInByPhone } = useCheckInActions(venueId);
  const { checkOut, checkOutByPhone } = useCheckOutActions(venueId);
  return {
    isBusy: [checkIn, checkInByCard, checkInByPhone, checkOut, checkOutByPhone].some((call) => call.isPending),
    member: async (memberId: string, action: DoorAction) =>
      (action === 'in' ? admitted(await checkIn.mutateAsync(memberId)) : released(await checkOut.mutateAsync(memberId))),
    card: async (code: string, action: DoorAction): Promise<DoorOutcome> =>
      (action === 'in' ? admitted(await checkInByCard.mutateAsync(code)) : { kind: 'card_out' }),
    phone: async (phone: string, action: DoorAction) =>
      (action === 'in' ? admitted(await checkInByPhone.mutateAsync(phone)) : released(await checkOutByPhone.mutateAsync(phone))),
  };
}

/**
 * The door's one field (console v3): a card the scanner reads, a mobile number, a member number or a name. A card or a
 * number goes straight through; a name or member number acts on the one member it finds, or lists them when there are
 * several. A done check-in empties the field, as does every scan, so the next scan never lands after a refused one.
 */
export function useDoorField(venueId: string) {
  const calls = useDoorCalls(venueId);
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<DoorOutcome | null>(null);
  const typed = doorQuery(text);
  const found = useMemberSearch(venueId, typed.kind === 'search' ? typed.query : '');
  const answer = async (query: Exclude<DoorQuery, { kind: 'none' }>, action: DoorAction): Promise<DoorOutcome> => {
    if (query.kind === 'card') return calls.card(query.code, action);
    if (query.kind === 'phone') return calls.phone(query.phone, action);
    const rows = (await found.refetch()).data ?? [];
    const [only] = rows;
    if (rows.length === 1 && only !== undefined) return calls.member(only.memberId, action);
    return rows.length === 0 ? { kind: 'no_match' } : { kind: 'several', action, matches: rows };
  };
  const settle = (next: DoorOutcome, isScan: boolean) => {
    setOutcome(next);
    if (isDone(next) || isScan) setText('');
  };
  const press = async (action: DoorAction) => {
    // A second tap on the field a check-in just emptied keeps its line, rather than asking for an entry.
    if (typed.kind === 'none') return text.trim() === '' && isDone(outcome) ? undefined : setOutcome({ kind: 'unusable' });
    return settle(await answer(typed, action), typed.kind === 'card');
  };
  return {
    text, outcome, isBusy: calls.isBusy, press,
    type: (next: string) => {
      setText(next);
      setOutcome(null);
    },
    choose: async (memberId: string, action: DoorAction) => settle(await calls.member(memberId, action), false),
  };
}
