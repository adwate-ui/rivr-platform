import { CALL_TIME_CHOICES, isCallTimeMinutes } from '@rivr/domain/callTime';
import { openSeatsAt, useFloorSeats, useHeldSeats, useWaitlistCallActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeChoice, ChoiceChips, ErrorMessage, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';

interface AssignFormProps {
  venueId: string;
  entryId: string;
  name: string;
  /** The game's open tables, one of which the member is assigned to. */
  tables: readonly FloorTable[];
  onDone: () => void;
}

/** The seats free at the chosen table, neither taken nor held (F2-18); none until a table is chosen. */
function useFreeSeats(venueId: string, table: FloorTable | undefined): number[] {
  const seats = useFloorSeats(venueId);
  const held = useHeldSeats(venueId);
  return table === undefined ? [] : openSeatsAt(table, [...(seats.data ?? []), ...(held.data ?? [])]);
}

/** A table chosen first when the game has only one open. */
const onlyTable = (tables: readonly FloorTable[]): string[] => (tables.length === 1 && tables[0] ? [tables[0].id] : []);

/**
 * Assigns a member to an open table of their game, a seat free at it (neither taken nor held, F2-18) and a call time, and
 * seats them at once (decision 0299); the seat-ready message still goes out by WhatsApp.
 */
export function AssignForm({ venueId, entryId, name, tables, onDone }: AssignFormProps) {
  const { assign } = useWaitlistCallActions();
  const [tableIds, setTableIds] = useState<string[]>(() => onlyTable(tables));
  const [picked, setPicked] = useState<number | null>(null);
  const [callMinutes, setCallMinutes] = useState<number | null>(CALL_TIME_CHOICES[0]);
  // 'choose' when no table, seat or call time is chosen; else why the assignment did not go through.
  const [failure, setFailure] = useState<WaitlistFailure | 'choose' | null>(null);
  const table = tables.find((candidate) => candidate.id === tableIds[0]);
  const free = useFreeSeats(venueId, table);
  // A seat taken since it was chosen (the floor is read every ten seconds) is no choice.
  const seat = picked !== null && free.includes(picked) ? picked : null;
  const assignNow = async () => {
    if (table === undefined || seat === null || !isCallTimeMinutes(callMinutes)) {
      setFailure('choose');
      return;
    }
    const assigned = await assign.mutateAsync({ entryId, tableId: table.id, seat, callMinutes });
    if (assigned.ok) onDone();
    else setFailure(assigned.error);
  };
  return (
    <Stack gap={3}>
      <ChoiceChips label={t('console.waitlist.callTable', { name })} mode="one" selected={tableIds} onChange={(chosen) => { setTableIds(chosen); setPicked(null); }}
        options={tables.map((one) => ({ value: one.id, label: one.name }))} />
      {table === undefined ? null : (
        <ChoiceChips label={t('console.waitlist.callSeat')} mode="one" selected={seat === null ? [] : [String(seat)]}
          options={free.map((number) => ({ value: String(number), label: String(number) }))}
          onChange={([value]) => setPicked(value === undefined ? null : Number(value))} />
      )}
      <CallTimeChoice choices={CALL_TIME_CHOICES} initial={CALL_TIME_CHOICES[0]} onChange={setCallMinutes} />
      <Inline gap={3} align="end">
        <Button variant="secondary" isLoading={assign.isPending} onClick={() => void assignNow()}>{t('console.waitlist.callConfirm')}</Button>
        <Button variant="text" onClick={onDone}>{t('common.cancel')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(failure === 'choose' ? 'console.waitlist.invalidCall' : ENTRY_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
