import { zodResolver } from '@hookform/resolvers/zod';
import { chipCountSchema, openShiftSchema } from '@rivr/contracts';
import { useTreasuryActions, type ChipCount, type ChipCountLine, type TreasuryFailure } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegisterReturn } from 'react-hook-form';
import type { z } from 'zod';
import { TREASURY_FAILURE_COPY } from './treasuryCopy.ts';

/** The typed counts, chip by chip, as the database takes them. */
function countsOf(lines: readonly ChipCountLine[], quantities: readonly string[]): ChipCount[] {
  return lines.map((line, index) => ({ value: line.value, quantity: Number(quantities[index] ?? '0') }));
}

/** One field per chip, smallest first: how many the cashier counted. */
function ChipFields({ lines, field, errors }: {
  lines: readonly ChipCountLine[];
  field: (index: number) => UseFormRegisterReturn;
  errors: FieldErrors<{ quantities: string[] }>['quantities'];
}) {
  return (
    <Grid columns={3} gap={4}>
      {lines.map((line, index) => (
        <Input key={line.name} {...field(index)} label={t('console.treasury.countOf', { chip: line.name })} inputMode="numeric" autoComplete="off"
          error={errors?.[index] ? t('console.treasury.countInvalid') : undefined} />
      ))}
    </Grid>
  );
}

/** Opening the cage's shift (#24): the float counted into the drawer and every chip counted; once per request id. */
export function OpenShiftForm({ venueId, lines, onOpened }: { venueId: string; lines: readonly ChipCountLine[]; onOpened: () => void }) {
  const { openShift } = useTreasuryActions(venueId);
  // The chips as the form opened: a reload of the list never moves a typed count onto another chip.
  const [chips] = useState(lines);
  const [failure, setFailure] = useState<TreasuryFailure | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(openShiftSchema));
  const form = useForm<z.input<typeof openShiftSchema>, unknown, z.output<typeof openShiftSchema>>({
    resolver, defaultValues: { float: '', quantities: chips.map(() => '') },
  });
  const changed = { onChange: () => setRequestId(crypto.randomUUID()) };
  const floatField = form.register('float', changed);
  const submit = form.handleSubmit(async (values) => {
    const done = await openShift.mutateAsync({ float: fromRupees(BigInt(values.float)), counts: countsOf(chips, values.quantities), requestId });
    setFailure(done.ok ? null : done.error);
    if (done.ok) onOpened();
  });
  return (
    <Stack gap={4}>
      <Input {...floatField} label={t('console.treasury.floatToOpen')} prefix={t('console.treasury.rupee')} inputMode="numeric"
        autoComplete="off" error={form.formState.errors.float ? t('console.treasury.floatInvalid') : undefined} />
      <ChipFields lines={chips} field={(index) => form.register(`quantities.${index}`, changed)} errors={form.formState.errors.quantities} />
      {failure === null ? null : <ErrorMessage>{t(TREASURY_FAILURE_COPY[failure])}</ErrorMessage>}
      <Inline>
        <Button variant="primary" isLoading={openShift.isPending} onClick={() => void submit()}>{t('console.treasury.openShift')}</Button>
      </Inline>
    </Stack>
  );
}

/** Counting the chips in the cage again during the shift, from the last count; once per request id. */
export function CountChipsForm({ venueId, lines, onDone }: { venueId: string; lines: readonly ChipCountLine[]; onDone: (saved: boolean) => void }) {
  const { countChips } = useTreasuryActions(venueId);
  const [chips] = useState(lines);
  const [failure, setFailure] = useState<TreasuryFailure | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(chipCountSchema));
  const form = useForm<z.input<typeof chipCountSchema>, unknown, z.output<typeof chipCountSchema>>({
    resolver, defaultValues: { quantities: chips.map((line) => (line.quantity === null ? '' : String(line.quantity))) },
  });
  const changed = { onChange: () => setRequestId(crypto.randomUUID()) };
  const submit = form.handleSubmit(async (values) => {
    const done = await countChips.mutateAsync({ counts: countsOf(chips, values.quantities), requestId });
    setFailure(done.ok ? null : done.error);
    if (done.ok) onDone(true);
  });
  return (
    <Stack gap={4}>
      <ChipFields lines={chips} field={(index) => form.register(`quantities.${index}`, changed)} errors={form.formState.errors.quantities} />
      {failure === null ? null : <ErrorMessage>{t(TREASURY_FAILURE_COPY[failure])}</ErrorMessage>}
      <Inline gap={3}>
        <Button variant="primary" isLoading={countChips.isPending} onClick={() => void submit()}>{t('console.treasury.saveCount')}</Button>
        <Button variant="secondary" onClick={() => onDone(false)}>{t('console.treasury.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
