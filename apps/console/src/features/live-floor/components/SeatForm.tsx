import { zodResolver } from '@hookform/resolvers/zod';
import { seatPlayerSchema } from '@rivr/contracts';
import { useSeatActions, type FloorTable, type HeldSeat, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack } from '@rivr/ui';
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

/** Seats a player found by mobile number in one of the table's open seats (not one held for a waitlist call); seating starts their session. */
export function SeatForm({ venueId, table, seats, held, onResult }: SeatFormProps) {
  const { seat } = useSeatActions(venueId);
  const open = Array.from({ length: table.seats }, (_, index) => index + 1)
    .filter((number) => !seats.some((taken) => taken.seat === number) && !held.some((kept) => kept.seat === number));
  const [chosen, setChosen] = useState<number | null>(null);
  const [resolver] = useState(() => zodResolver(seatPlayerSchema));
  const form = useForm<z.input<typeof seatPlayerSchema>, unknown, z.output<typeof seatPlayerSchema>>({ resolver, defaultValues: { phone: '' } });
  const submit = form.handleSubmit(async ({ phone }) => {
    if (chosen === null) return;
    const seated = await seat.mutateAsync({ tableId: table.id, seat: chosen, phone });
    onResult(seated);
    if (seated.ok) { form.reset(); setChosen(null); }
  });
  if (open.length === 0) return null;
  const phone = form.register('phone');
  return (
    <Stack gap={3}>
      <Heading level={3}>{t('console.liveFloor.seatPlayer')}</Heading>
      <ChoiceChips label={t('console.liveFloor.seatNumber')} mode="one" options={open.map((number) => ({ value: String(number), label: String(number) }))}
        selected={chosen === null ? [] : [String(chosen)]} onChange={([value]) => setChosen(value === undefined ? null : Number(value))} />
      <Inline gap={3} align="end">
        <Input {...phone} type="tel" label={t('console.liveFloor.phone')} prefix={t('common.signIn.countryCode')} inputMode="tel" autoComplete="off" />
        <Button variant="secondary" isDisabled={chosen === null} isLoading={seat.isPending} onClick={() => void submit()}>{t('console.liveFloor.seat')}</Button>
      </Inline>
      {form.formState.errors.phone ? <ErrorMessage>{t('console.liveFloor.invalidPhone')}</ErrorMessage> : null}
    </Stack>
  );
}
