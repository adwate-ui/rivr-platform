import { openSeatsAt, useFloorSeats, useHeldSeats, useWaitlistCallActions, type FloorTable, type WaitlistFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';
import { ENTRY_FAILURE_COPY } from './failureCopy.ts';

interface CallFormProps {
  venueId: string;
  entryId: string;
  name: string;
  /** The game's open tables, one of which the member is called to. */
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
 * Calls a member to an open table of their game and a seat free at it, chosen from the seats neither taken nor held (F2-18);
 * the seat call goes out by WhatsApp.
 */
export function CallForm({ venueId, entryId, name, tables, onDone }: CallFormProps) {
  const { call } = useWaitlistCallActions();
  const [tableIds, setTableIds] = useState<string[]>(() => onlyTable(tables));
  const [picked, setPicked] = useState<number | null>(null);
  // 'choose' when no table or no seat at it is chosen; else why the call did not go through.
  const [failure, setFailure] = useState<WaitlistFailure | 'choose' | null>(null);
  const table = tables.find((candidate) => candidate.id === tableIds[0]);
  const free = useFreeSeats(venueId, table);
  // A seat taken since it was chosen (the floor is read every ten seconds) is no choice.
  const seat = picked !== null && free.includes(picked) ? picked : null;
  const callNow = async () => {
    if (table === undefined || seat === null) {
      setFailure('choose');
      return;
    }
    const called = await call.mutateAsync({ entryId, tableId: table.id, seat });
    if (called.ok) onDone();
    else setFailure(called.error);
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
      <Inline gap={3} align="end">
        <Button variant="secondary" isLoading={call.isPending} onClick={() => void callNow()}>{t('console.waitlist.callConfirm')}</Button>
        <Button variant="text" onClick={onDone}>{t('common.cancel')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(failure === 'choose' ? 'console.waitlist.invalidCall' : ENTRY_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
