import { CALL_TIME_CHOICES, isCallTimeMinutes } from '@rivr/domain/callTime';
import { openSeatsAt, useFloorSeats, useHeldSeats, useWaitlistCallActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeChoice, ChoiceChips, ErrorMessage, Inline, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';
import { stakeOf } from './placeMeta.ts';

/** Who the sheet seats: the place, by its entry. */
export interface SeatSheetPlace {
  readonly entryId: string;
  readonly name: string;
}

interface SeatSheetProps {
  venueId: string;
  /** The table whose list the place is on (decision 0467): the only table it is seated at. */
  table: FloorTable;
  place: SeatSheetPlace | null;
  onClose: () => void;
}

/** The seats free at the table, neither taken nor held for a called member (F2-18). */
function useFreeSeats(venueId: string, table: FloorTable): number[] {
  const seats = useFloorSeats(venueId);
  const held = useHeldSeats(venueId);
  return openSeatsAt(table, [...(seats.data ?? []), ...(held.data ?? [])]);
}

/** The sheet's form: a free seat and a call time; Seat, in the sheet's footer, seats the member at once (decision 0299). */
function useSeatForm({ venueId, table, place, onDone }: { venueId: string; table: FloorTable; place: SeatSheetPlace; onDone: () => void }) {
  const { assign } = useWaitlistCallActions();
  const toast = useToast();
  const free = useFreeSeats(venueId, table);
  const [picked, setPicked] = useState<number | null>(null);
  // The stake's own call time to start from (decision 0299); another is the floor's choice.
  const [callMinutes, setCallMinutes] = useState<number | null>(table.callTimeMinutes);
  const [failure, setFailure] = useState<WaitlistFailure | 'choose' | null>(null);
  // A seat taken since it was chosen (the floor is read every ten seconds) is no choice.
  const seat = picked !== null && free.includes(picked) ? picked : null;
  const seatNow = async () => {
    if (seat === null || !isCallTimeMinutes(callMinutes)) return setFailure('choose');
    const done = await assign.mutateAsync({ entryId: place.entryId, tableId: table.id, seat, callMinutes });
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
        {failure === null ? null : <ErrorMessage>{t(failure === 'choose' ? 'console.waitlist.invalidCall' : ENTRY_FAILURE_COPY[failure])}</ErrorMessage>}
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
 * Seat from a table's list (console v3): the console's sheet with the seats free at the list's own table and a call time.
 * Seat assigns and seats the member at once (decision 0299); the seat-ready message still goes out by WhatsApp.
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
