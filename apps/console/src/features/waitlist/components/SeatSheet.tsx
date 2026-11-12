import { bonusChipsToRedeemSchema } from '@rivr/contracts';
import { CALL_TIME_CHOICES, isCallTimeMinutes } from '@rivr/domain/callTime';
import { openSeatsAt, useFloorSeats, useHeldSeats, useWaitlistCallActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { useMemberBonus, useMemberBonusVisitLeft } from '@rivr/db/bonus';
import { formatChips, t, type MessageKey } from '@rivr/i18n';
import { Button, CallTimeChoice, ChoiceChips, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';
import { stakeOf } from './placeMeta.ts';

/** Who the sheet seats: the place, by its entry, and its member, whose bonus chips it shows (decision 0504). */
export interface SeatSheetPlace {
  readonly entryId: string;
  readonly memberId: string;
  readonly name: string;
}

/**
 * The member's bonus chips, under the field for those they redeem: nothing until it has come; with what this visit may
 * still redeem where the club caps it (decision 0579).
 */
function bonusHint(balance: bigint | null | undefined, left: bigint | null | undefined): string | undefined {
  if (balance === undefined || balance === null) return undefined;
  if (balance === 0n) return t('console.waitlist.bonusChipsNone');
  if (left === undefined || left === null) return t('console.waitlist.bonusChipsHas', { chips: formatChips(balance) });
  return t('console.waitlist.bonusChipsLeft', { chips: formatChips(balance), left: formatChips(left) });
}

/** Why Seat did not go through: no seat or call time chosen, bonus chips not whole 50s, or the database's refusal. */
function failureCopy(failure: WaitlistFailure | 'choose' | 'bonus'): MessageKey {
  if (failure === 'choose') return 'console.waitlist.invalidCall';
  return failure === 'bonus' ? 'console.waitlist.badBonusChips' : ENTRY_FAILURE_COPY[failure];
}

/** The bonus chips field (decision 0504): what is typed, with the member's balance under it. */
function useBonusField(venueId: string, memberId: string, onChange: () => void) {
  const [text, setText] = useState('');
  const balance = useMemberBonus(venueId, memberId).data;
  const left = useMemberBonusVisitLeft(venueId, memberId).data;
  return {
    text,
    field: (
      <Input label={t('console.waitlist.bonusChips')} hint={bonusHint(balance, left)} value={text} inputMode="numeric" autoComplete="off"
        onChange={(event) => { setText(event.target.value); onChange(); }} />
    ),
  };
}

interface SeatSheetProps {
  venueId: string;
  /** The table whose list the place is on (decision 0467): the only table it is seated at. */
  table: FloorTable;
  place: SeatSheetPlace | null;
  onClose: () => void;
}

/** The seats to offer: the one held for this place if it was called, else those neither taken nor held for a called member (F2-18). */
function useFreeSeats(venueId: string, table: FloorTable, entryId: string): { free: number[]; heldSeat: number | undefined } {
  const seats = useFloorSeats(venueId);
  const held = useHeldSeats(venueId);
  const heldSeat = held.data?.find((one) => one.entryId === entryId)?.seat;
  return { free: heldSeat === undefined ? openSeatsAt(table, [...(seats.data ?? []), ...(held.data ?? [])]) : [heldSeat], heldSeat };
}

/** The sheet's form: a free seat and a call time; Seat, in the sheet's footer, seats the member at once (decision 0299). */
function useSeatForm({ venueId, table, place, onDone }: { venueId: string; table: FloorTable; place: SeatSheetPlace; onDone: () => void }) {
  const { assign } = useWaitlistCallActions();
  const toast = useToast();
  const { free, heldSeat } = useFreeSeats(venueId, table, place.entryId);
  const [picked, setPicked] = useState<number | null>(null);
  // The stake's own call time to start from (decision 0299); another is the floor's choice.
  const [callMinutes, setCallMinutes] = useState<number | null>(table.callTimeMinutes);
  const [failure, setFailure] = useState<WaitlistFailure | 'choose' | 'bonus' | null>(null);
  // Bonus chips the member redeems with their buy-in (decision 0504), as typed; blank is none.
  const bonus = useBonusField(venueId, place.memberId, () => setFailure(null));
  // A seat taken since it was chosen (the floor is read every ten seconds) is no choice.
  const seat = picked !== null && free.includes(picked) ? picked : (heldSeat ?? null);
  const seatNow = async () => {
    if (seat === null || !isCallTimeMinutes(callMinutes)) return setFailure('choose');
    const bonusChips = bonusChipsToRedeemSchema.safeParse(bonus.text);
    if (!bonusChips.success) return setFailure('bonus');
    const done = await assign.mutateAsync({ entryId: place.entryId, tableId: table.id, seat, callMinutes, bonusChips: bonusChips.data });
    if (!done.ok) return setFailure(done.error);
    toast(t('console.waitlist.toast.seated', { name: place.name, table: table.name, seat }));
    return onDone();
  };
  return {
    body: (
      <Stack gap={6}>
        <ChoiceChips label={t('console.waitlist.callSeat')} mode="one" look="subtle" selected={seat === null ? [] : [String(seat)]}
          options={free.map((number) => ({ value: String(number), label: String(number) }))}
          onChange={([value]) => setPicked(value === undefined ? null : Number(value))} />
        <CallTimeChoice choices={CALL_TIME_CHOICES} initial={table.callTimeMinutes} onChange={setCallMinutes} />
        {bonus.field}
        {failure === null ? null : <ErrorMessage>{t(failureCopy(failure))}</ErrorMessage>}
      </Stack>
    ),
    footer: (
      <Inline gap={2} justify="end">
        <Button variant="text" onClick={onDone}>{t('common.cancel')}</Button>
        <Button variant="primary" isLoading={assign.isPending} onClick={() => void seatNow()}>{t('console.waitlist.seatShort')}</Button>
      </Inline>
    ),
  };
}

/**
 * Seat from a table's list (console v3): the console's sheet with the seats free at the list's own table, a call time, and
 * any bonus chips the member redeems with their buy-in (decision 0504). Seat assigns and seats the member at once
 * (decision 0299), and tells them nothing (the owner, 8 Nov).
 */
export function SeatSheet({ venueId, table, place, onClose }: SeatSheetProps) {
  return place === null ? null : <OpenSeatSheet key={place.entryId} venueId={venueId} table={table} place={place} onClose={onClose} />;
}

/** The sheet open for one place: its form in the body, Cancel and Seat in the footer that stays while the body scrolls. */
function OpenSeatSheet({ venueId, table, place, onClose }: { venueId: string; table: FloorTable; place: SeatSheetPlace; onClose: () => void }) {
  const form = useSeatForm({ venueId, table, place, onDone: onClose });
  return (
    <Sheet place="console" isOpen onClose={onClose} title={t('console.waitlist.seatSheet.title', { name: place.name })}
      subtitle={t('console.waitlist.seatSheet.subtitle', { table: table.name, stake: stakeOf(table) })} footer={form.footer}>
      {form.body}
    </Sheet>
  );
}
