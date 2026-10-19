import { useFloorSeats, useHeldSeats, useSeatActions, type FloorTable, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, Heading, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';

interface MoveFormProps {
  venueId: string;
  player: SeatedPlayer;
  tables: readonly FloorTable[];
  onDone: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
  onCancel: () => void;
}

/** Moves a player to an open seat at an open table (not one held for a waitlist call): the same session, so their call time runs on. */
export function MoveForm({ venueId, player, tables, onDone, onCancel }: MoveFormProps) {
  const { move } = useSeatActions(venueId);
  const seats = useFloorSeats(venueId);
  const held = useHeldSeats(venueId);
  const [tableId, setTableId] = useState<string | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const open = tables.filter((table) => table.isOpen);
  const target = open.find((table) => table.id === tableId);
  const unavailable = [...(seats.data ?? []), ...(held.data ?? [])].filter((taken) => taken.tableId === tableId).map((taken) => taken.seat);
  const free = target === undefined ? [] : Array.from({ length: target.seats }, (_, index) => index + 1).filter((number) => !unavailable.includes(number));
  const submit = async () => {
    if (tableId === null || seat === null) return;
    onDone(await move.mutateAsync({ sessionId: player.sessionId, tableId, seat }));
  };
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.liveFloor.moveTitle', { name: player.fullName })}</Heading>
      <ChoiceChips label={t('console.liveFloor.table')} mode="one" options={open.map((table) => ({ value: table.id, label: table.name }))}
        selected={tableId === null ? [] : [tableId]} onChange={([id]) => { setTableId(id ?? null); setSeat(null); }} />
      {target === undefined ? null : (
        <ChoiceChips label={t('console.liveFloor.seatNumber')} mode="one" options={free.map((number) => ({ value: String(number), label: String(number) }))}
          selected={seat === null ? [] : [String(seat)]} onChange={([value]) => setSeat(value === undefined ? null : Number(value))} />
      )}
      <Inline gap={3}>
        <Button variant="secondary" isDisabled={seat === null} isLoading={move.isPending} onClick={() => void submit()}>{t('console.liveFloor.move')}</Button>
        <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
