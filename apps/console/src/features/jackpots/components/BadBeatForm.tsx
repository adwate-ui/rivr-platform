import { zodResolver } from '@hookform/resolvers/zod';
import { badBeatSchema } from '@rivr/contracts';
import { useFloorTables, useJackpotActions, type JackpotFailure } from '@rivr/db';
import { badBeatPayout, type PayoutRule } from '@rivr/domain/jackpot';
import type { Paise } from '@rivr/domain/money';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { jackpotFailureText, previewText } from './jackpotCopy.ts';

type BadBeatValues = z.input<typeof badBeatSchema>;
type BadBeatFormApi = UseFormReturn<BadBeatValues, unknown, z.output<typeof badBeatSchema>>;

const EMPTY: BadBeatValues = { tableId: '', loserPhone: '', winnerPhone: '', otherPhones: '' };

/** How many others the field names, as the schema counts them: numbers separated by commas or lines. */
const countOthers = (text: string) => text.split(/[,\n]+/).filter((phone) => phone.trim() !== '').length;

/** The venue's tables, to choose the one the bad beat was at; `onEdit` runs on a choice. */
function TableChoice({ form, venueId, onEdit }: { form: BadBeatFormApi; venueId: string; onEdit: () => void }) {
  const tables = useFloorTables();
  if (tables.data === undefined && tables.isError) {
    return (
      <Inline gap={3}>
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button onClick={() => void tables.refetch()}>{t('common.retry')}</Button>
      </Inline>
    );
  }
  if (tables.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  const venueTables = tables.data.filter((table) => table.venueId === venueId);
  if (venueTables.length === 0) return <Text tone="muted">{t('console.jackpots.noTables')}</Text>;
  return (
    <Controller control={form.control} name="tableId" render={({ field }) => (
      <ChoiceChips label={t('console.jackpots.table')} mode="one" selected={field.value === '' ? [] : [field.value]}
        options={venueTables.map((table) => ({ value: table.id, label: table.name }))}
        onChange={(chosen) => { onEdit(); field.onChange(chosen[0] ?? ''); }} />
    )} />
  );
}

/** The loser's, the winner's and the others' mobile numbers; `onEdit` runs on every change. */
function PlayerFields({ form, onEdit }: { form: BadBeatFormApi; onEdit: () => void }) {
  const errors = form.formState.errors;
  const edited = { onChange: onEdit };
  const fields = { loser: form.register('loserPhone', edited), winner: form.register('winnerPhone', edited), others: form.register('otherPhones', edited) };
  return (
    <>
      <Inline gap={4} align="start" wrap>
        <Input {...fields.loser} type="tel" inputMode="tel" label={t('console.jackpots.loser')} error={errors.loserPhone ? t('console.jackpots.invalidLoser') : undefined} />
        <Input {...fields.winner} type="tel" inputMode="tel" label={t('console.jackpots.winner')} error={errors.winnerPhone ? t('console.jackpots.invalidWinner') : undefined} />
      </Inline>
      <Input {...fields.others} label={t('console.jackpots.others')} hint={t('console.jackpots.othersHint')} error={errors.otherPhones ? t('console.jackpots.invalidOthers') : undefined} />
    </>
  );
}

/**
 * Pays a bad beat in chips: the table, the loser, the winner and the others dealt in, by mobile
 * number. What it comes to shows before it is paid (@rivr/domain badBeatPayout on the pool as last
 * read); the database pays only that total, refusing if the pool has moved since, so the chips
 * handed out are the ones shown. One request per payout: any change to the form starts a new one.
 */
export function BadBeatForm({ venueId, pool, rule }: { venueId: string; pool: Paise; rule: PayoutRule }) {
  const { pay } = useJackpotActions(venueId);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<JackpotFailure | null>(null);
  const [paidSplit, setPaidSplit] = useState<string | null>(null);
  const [resolver] = useState(() => zodResolver(badBeatSchema));
  const form = useForm<BadBeatValues, unknown, z.output<typeof badBeatSchema>>({ resolver, defaultValues: EMPTY });
  const others = countOthers(useWatch({ control: form.control, name: 'otherPhones' }));
  const payout = badBeatPayout(pool, rule, others);
  const edited = () => {
    setPaidSplit(null);
    setRequestId(crypto.randomUUID());
  };
  const submit = form.handleSubmit(async (beat) => {
    const paid = await pay.mutateAsync({ ...beat, expectedTotal: payout.total, requestId });
    setFailure(paid.ok ? null : paid.error);
    setPaidSplit(paid.ok ? previewText(payout, others) : null);
    if (paid.ok) form.reset(EMPTY);
  });
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.jackpots.payout')}</Heading>
      <TableChoice form={form} venueId={venueId} onEdit={edited} />
      {form.formState.errors.tableId ? <ErrorMessage>{t('console.jackpots.chooseTable')}</ErrorMessage> : null}
      <PlayerFields form={form} onEdit={edited} />
      <Text>{previewText(payout, others)}</Text>
      <Button variant="primary" isLoading={pay.isPending} isDisabled={payout.total === 0n} onClick={() => void submit()}>
        {t('console.jackpots.pay', { total: formatMoney(payout.total) })}
      </Button>
      {paidSplit === null ? null : <Text variant="small">{t('console.jackpots.paid', { split: paidSplit })}</Text>}
      {failure === null ? null : <ErrorMessage>{jackpotFailureText(failure)}</ErrorMessage>}
    </Stack>
  );
}
