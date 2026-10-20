import { zodResolver } from '@hookform/resolvers/zod';
import { closeShiftSchema } from '@rivr/contracts';
import { useEodActions, type ChipCountLine, type EodFailure } from '@rivr/db';
import { fromRupees } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ChipFields, countsOf } from './ChipCountForm.tsx';
import { EOD_FAILURE_COPY } from './eodCopy.ts';

/**
 * Closing the cage's shift (#45): the cash in the drawer, the UPI and bank receipts, the signed markers
 * held and the chips, counted blind: nothing the ledger expects is shown until the shift is closed.
 * Once per request id.
 */
export function CloseShiftForm({ venueId, lines, onClosed }: { venueId: string; lines: readonly ChipCountLine[]; onClosed: () => void }) {
  const { close } = useEodActions(venueId);
  // The chips as the form opened: a reload of the list never moves a typed count onto another chip.
  const [chips] = useState(lines);
  const [failure, setFailure] = useState<EodFailure | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [resolver] = useState(() => zodResolver(closeShiftSchema));
  const form = useForm<z.input<typeof closeShiftSchema>, unknown, z.output<typeof closeShiftSchema>>({
    resolver, defaultValues: { cash: '', receipts: '', markers: '', quantities: chips.map(() => '') },
  });
  const changed = { onChange: () => setRequestId(crypto.randomUUID()) };
  const amounts = [
    { field: form.register('cash', changed), label: t('console.endOfDay.cash'), isInvalid: form.formState.errors.cash !== undefined },
    { field: form.register('receipts', changed), label: t('console.endOfDay.receipts'), isInvalid: form.formState.errors.receipts !== undefined },
    { field: form.register('markers', changed), label: t('console.endOfDay.markers'), isInvalid: form.formState.errors.markers !== undefined },
  ];
  const submit = form.handleSubmit(async (values) => {
    const done = await close.mutateAsync({
      cash: fromRupees(BigInt(values.cash)), receipts: fromRupees(BigInt(values.receipts)), markers: fromRupees(BigInt(values.markers)),
      counts: countsOf(chips, values.quantities), requestId,
    });
    setFailure(done.ok ? null : done.error);
    if (done.ok) onClosed();
  });
  return (
    <Stack gap={4}>
      <Text variant="small" tone="muted">{t('console.endOfDay.closeIntro')}</Text>
      <Grid columns={3} gap={4}>
        {amounts.map((amount) => (
          <Input key={amount.label} {...amount.field} label={amount.label} prefix={t('console.treasury.rupee')} inputMode="numeric" autoComplete="off"
            error={amount.isInvalid ? t('console.endOfDay.amountInvalid') : undefined} />
        ))}
      </Grid>
      <ChipFields lines={chips} field={(index) => form.register(`quantities.${index}`, changed)} errors={form.formState.errors.quantities} />
      {failure === null ? null : <ErrorMessage>{t(EOD_FAILURE_COPY[failure])}</ErrorMessage>}
      <Inline>
        <Button variant="primary" isLoading={close.isPending} onClick={() => void submit()}>{t('console.endOfDay.closeShift')}</Button>
      </Inline>
    </Stack>
  );
}
