import { zodResolver } from '@hookform/resolvers/zod';
import { seatPlayerSchema } from '@rivr/contracts';
import { CALL_TIME_CHOICES, isCallTimeMinutes } from '@rivr/domain/callTime';
import { openSeatsAt, useSeatActions, type FloorTable, type HeldSeat, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeChoice, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

interface SeatFormProps {
  venueId: string;
  table: FloorTable;
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  onResult: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
}

/**
 * Seats a player found by mobile or membership number (decision 0299) in one of the table's open seats (not one held for
 * a waitlist call), with the call time the floor chose; seating starts their session.
 */
export function SeatForm({ venueId, table, seats, held, onResult }: SeatFormProps) {
  const { seat } = useSeatActions(venueId);
  const open = openSeatsAt(table, [...seats, ...held]);
  const [picked, setPicked] = useState<number | null>(null);
  // The stake's own call time to start from (decision 0299); another is the floor's choice.
  const [callMinutes, setCallMinutes] = useState<number | null>(table.callTimeMinutes);
  // A seat taken since it was chosen (the floor is read every ten seconds) is no choice (F2-17).
  const chosen = picked !== null && open.includes(picked) ? picked : null;
  const [resolver] = useState(() => zodResolver(seatPlayerSchema));
  const form = useForm<z.input<typeof seatPlayerSchema>, unknown, z.output<typeof seatPlayerSchema>>({ resolver, defaultValues: { number: '' } });
  const submit = form.handleSubmit(async ({ number }) => {
    if (chosen === null || !isCallTimeMinutes(callMinutes)) return;
    const seated = await seat.mutateAsync({ tableId: table.id, seat: chosen, who: number, callMinutes });
    onResult(seated);
    if (seated.ok) { form.reset(); setPicked(null); }
  });
  if (open.length === 0) return null;
  const number = form.register('number');
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.liveFloor.seatPlayer')}</Heading>
      <ChoiceChips label={t('console.liveFloor.seatNumber')} mode="one" options={open.map((one) => ({ value: String(one), label: String(one) }))}
        selected={chosen === null ? [] : [String(chosen)]} onChange={([value]) => setPicked(value === undefined ? null : Number(value))} />
      <CallTimeChoice choices={CALL_TIME_CHOICES} initial={table.callTimeMinutes} onChange={setCallMinutes} />
      <Inline gap={3} align="end">
        <Input {...number} label={t('console.liveFloor.phone')} inputMode="numeric" autoComplete="off" />
        <Button variant="secondary" isDisabled={chosen === null} isLoading={seat.isPending} onClick={() => void submit()}>{t('console.liveFloor.seat')}</Button>
      </Inline>
      {form.formState.errors.number ? <ErrorMessage>{t('console.liveFloor.invalidPhone')}</ErrorMessage> : null}
      {isCallTimeMinutes(callMinutes) ? null : <ErrorMessage>{t('console.liveFloor.invalidCallTime')}</ErrorMessage>}
    </Stack>
  );
}
