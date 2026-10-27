import { zodResolver } from '@hookform/resolvers/zod';
import { REWARD_KINDS, rewardItemSchema } from '@rivr/contracts';
import { useSaveRewardItem, type RewardItem, type RewardItemOrder } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Input, Stack, Switch, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

type RewardValues = z.input<typeof rewardItemSchema>;
type RewardFormApi = UseFormReturn<RewardValues, unknown, z.output<typeof rewardItemSchema>>;

const EMPTY: RewardValues = { kind: 'merchandise', name: '', detail: '', price: '', stock: '', isLive: true };

/** The form's values for a reward being changed, or a new one. */
function valuesOf(item: RewardItem | null): RewardValues {
  if (item === null) return EMPTY;
  return {
    kind: item.kind, name: item.name, detail: item.detail, price: String(item.nights ?? item.points ?? ''), stock: item.stock === null ? '' : String(item.stock),
    isLive: item.isLive,
  };
}

/** What the form saves: the price in nights for a hotel night, else in points, and the stock the editor was shown. */
function orderOf(values: z.output<typeof rewardItemSchema>, item: RewardItem | null): RewardItemOrder {
  const { price, ...rest } = values;
  const isNights = values.kind === 'hotel_night';
  return { ...rest, points: isNights ? null : price, nights: isNights ? price : null, itemId: item?.id ?? null, stockWas: item?.stock ?? null };
}

/** The kind, chosen from the catalogue's four, and whether it is on offer. */
function Choices({ form }: { form: RewardFormApi }) {
  return (
    <>
      <Controller control={form.control} name="kind" render={({ field }) => (
        <ChoiceChips label={t('console.rewards.kind')} mode="one" selected={[field.value]}
          options={REWARD_KINDS.map((kind) => ({ value: kind, label: t(`console.rewards.kinds.${kind}`) }))}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(chosen[0]); }} />
      )} />
      <Controller control={form.control} name="isLive" render={({ field }) => (
        <Switch label={t('console.rewards.onOffer')} hint={t('console.rewards.onOfferHint')} isOn={field.value} onChange={field.onChange} />
      )} />
    </>
  );
}

/** The name, where to collect it, the price (in nights for a hotel night, else points) and the stock. */
function Fields({ form }: { form: RewardFormApi }) {
  const errors = form.formState.errors;
  const isNights = form.watch('kind') === 'hotel_night';
  const error = (isWrong: boolean, key: 'invalidName' | 'invalidDetail' | 'invalidPrice' | 'invalidNights' | 'invalidStock') => (isWrong ? t(`console.rewards.${key}`) : undefined);
  const fields = { name: form.register('name'), detail: form.register('detail'), price: form.register('price'), stock: form.register('stock') };
  return (
    <>
      <Input {...fields.name} label={t('console.rewards.name')} autoComplete="off" error={error(errors.name !== undefined, 'invalidName')} />
      <Input {...fields.detail} label={t('console.rewards.detail')} hint={t('console.rewards.detailHint')} autoComplete="off"
        error={error(errors.detail !== undefined, 'invalidDetail')} />
      <Inline gap={4} align="start" wrap>
        <Input {...fields.price} label={t(isNights ? 'console.rewards.priceNights' : 'console.rewards.price')} inputMode="numeric" autoComplete="off"
          error={error(errors.price !== undefined, isNights ? 'invalidNights' : 'invalidPrice')} />
        <Input {...fields.stock} label={t('console.rewards.stock')} hint={t('console.rewards.stockHint')} inputMode="numeric" autoComplete="off"
          error={error(errors.stock !== undefined, 'invalidStock')} />
      </Inline>
    </>
  );
}

/**
 * Adds a reward to the catalogue, or changes the one chosen (`item`): its kind, name, where to collect it,
 * its price (nights for a hotel night, else points) and how many are left. `onDone` runs once it is saved or the
 * change is cancelled.
 */
export function RewardForm({ venueId, item, onDone }: { venueId: string; item: RewardItem | null; onDone: () => void }) {
  const save = useSaveRewardItem(venueId);
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const [resolver] = useState(() => zodResolver(rewardItemSchema));
  const form = useForm<RewardValues, unknown, z.output<typeof rewardItemSchema>>({ resolver, defaultValues: valuesOf(item) });
  const submit = form.handleSubmit(async (values) => {
    const saved = await save.mutateAsync(orderOf(values, item));
    setOutcome(saved.ok ? { ok: true, text: t('console.rewards.saved', { name: values.name }) } : { ok: false, text: t(`console.rewards.failures.${saved.error}`) });
    if (saved.ok && item === null) form.reset(EMPTY);
    if (saved.ok && item !== null) onDone();
  });
  return (
    <Stack gap={4}>
      <Heading level={2} variant="section">{item === null ? t('console.rewards.newReward') : t('console.rewards.editName', { name: item.name })}</Heading>
      <Choices form={form} />
      <Fields form={form} />
      <Inline gap={4} align="center">
        <Button variant="primary" isLoading={save.isPending} onClick={() => void submit()}>{t('console.rewards.save')}</Button>
        {item === null ? null : <Button variant="text" onClick={onDone}>{t('console.rewards.cancel')}</Button>}
        {outcome?.ok === true ? <Text>{outcome.text}</Text> : null}
      </Inline>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}
