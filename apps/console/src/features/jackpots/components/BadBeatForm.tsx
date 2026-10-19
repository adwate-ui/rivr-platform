import { zodResolver } from '@hookform/resolvers/zod';
import { badBeatSchema } from '@rivr/contracts';
import { useFloorTables, useJackpotActions, type JackpotFailure } from '@rivr/db';
import { badBeatPayout, type PayoutRule } from '@rivr/domain/jackpot';
import type { Paise } from '@rivr/domain/money';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import type { z } from 'zod';
import { jackpotFailureText, previewText } from './jackpotCopy.ts';

type BadBeatValues = z.input<typeof badBeatSchema>;

const EMPTY: BadBeatValues = { tableId: '', loserPhone: '', winnerPhone: '', otherPhones: '' };

/** How many others the field names, as the schema counts them: numbers separated by commas or lines. */
const countOthers = (text: string) => text.split(/[,\n]+/).filter((phone) => phone.trim() !== '').length;

/** The venue's tables, to choose the one the bad beat was at. */
function TableChoice({ control, venueId }: { control: Control<BadBeatValues, unknown, z.output<typeof badBeatSchema>>; venueId: string }) {
  const tables = useFloorTables();
  return (
    <Controller control={control} name="tableId" render={({ field }) => (
      <ChoiceChips label={t('console.jackpots.table')} mode="one" selected={field.value === '' ? [] : [field.value]}
        options={(tables.data ?? []).filter((table) => table.venueId === venueId).map((table) => ({ value: table.id, label: table.name }))}
        onChange={(chosen) => field.onChange(chosen[0] ?? '')} />
    )} />
  );
}

/**
 * Pays a bad beat in chips: the table, the loser, the winner and the others dealt in, by mobile
 * number. What it comes to shows before it is paid (@rivr/domain badBeatPayout on the pool now); the
 * database works it out again on the pool as it stands when it is paid. A new request for each payout.
 */
export function BadBeatForm({ venueId, pool, rule }: { venueId: string; pool: Paise; rule: PayoutRule }) {
  const { pay } = useJackpotActions(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<JackpotFailure | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [resolver] = useState(() => zodResolver(badBeatSchema));
  const form = useForm<BadBeatValues, unknown, z.output<typeof badBeatSchema>>({ resolver, defaultValues: EMPTY });
  const others = countOthers(useWatch({ control: form.control, name: 'otherPhones' }));
  const payout = badBeatPayout(pool, rule, others);
  const submit = form.handleSubmit(async (beat) => {
    const paid = await pay.mutateAsync({ ...beat, requestId });
    setFailure(paid.ok ? null : paid.error);
    setIsPaid(paid.ok);
    if (paid.ok) {
      form.reset(EMPTY);
      setRequestId(crypto.randomUUID());
    }
  });
  const errors = form.formState.errors;
  const edited = { onChange: () => setIsPaid(false) };
  const fields = { loser: form.register('loserPhone', edited), winner: form.register('winnerPhone', edited), others: form.register('otherPhones', edited) };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.jackpots.payout')}</Heading>
      <TableChoice control={form.control} venueId={venueId} />
      {errors.tableId ? <ErrorMessage>{t('console.jackpots.chooseTable')}</ErrorMessage> : null}
      <Inline gap={4} align="start" wrap>
        <Input {...fields.loser} type="tel" inputMode="tel" label={t('console.jackpots.loser')} error={errors.loserPhone ? t('console.jackpots.invalidLoser') : undefined} />
        <Input {...fields.winner} type="tel" inputMode="tel" label={t('console.jackpots.winner')} error={errors.winnerPhone ? t('console.jackpots.invalidWinner') : undefined} />
      </Inline>
      <Input {...fields.others} label={t('console.jackpots.others')} hint={t('console.jackpots.othersHint')} error={errors.otherPhones ? t('console.jackpots.invalidOthers') : undefined} />
      <Text>{previewText(payout, others)}</Text>
      <Button variant="primary" isLoading={pay.isPending} isDisabled={payout.total === 0n} onClick={() => void submit()}>{t('console.jackpots.pay', { total: formatMoney(payout.total) })}</Button>
      {isPaid ? <Text variant="small">{t('console.jackpots.paid')}</Text> : null}
      {failure === null ? null : <ErrorMessage>{jackpotFailureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
