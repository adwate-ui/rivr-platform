import { zodResolver } from '@hookform/resolvers/zod';
import { HIGH_HAND_CATEGORIES, HIGH_HAND_RANKS, highHandClaimSchema } from '@rivr/contracts';
import { useClaimHighHand, type HighHandClaimFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Inline, Stack } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { highHandFailureText } from './handCopy.ts';

const SEATS = Array.from({ length: 10 }, (_, index) => index + 1);
const CATEGORY_OPTIONS = HIGH_HAND_CATEGORIES.map((category) => ({ value: category, label: t(`tv.highHand.${category}`) }));
const RANK_OPTIONS = HIGH_HAND_RANKS.map((rank) => ({ value: rank, label: t(`tv.ranks.${rank}`) }));
const SEAT_OPTIONS = SEATS.map((seat) => ({ value: String(seat), label: String(seat) }));

interface HighHandFormProps {
  handId: string;
  /** Claimed, with what to say; or null when the dealer cancels. */
  onDone: (claimed: string | null) => void;
}

/** The dealer claims a high hand for one of the down's hands: the hand, the seat, and for four of a kind its rank. */
export function HighHandForm({ handId, onDone }: HighHandFormProps) {
  const claim = useClaimHighHand();
  const [failure, setFailure] = useState<HighHandClaimFailure | null>(null);
  const [resolver] = useState(() => zodResolver(highHandClaimSchema));
  const form = useForm<z.input<typeof highHandClaimSchema>, unknown, z.output<typeof highHandClaimSchema>>({
    resolver, defaultValues: { category: 'straight_flush', seat: 1, rank: null },
  });
  const [category, seat] = useWatch({ control: form.control, name: ['category', 'seat'] });
  const submit = form.handleSubmit(async (values) => {
    const claimed = await claim.mutateAsync({ handId, ...values });
    setFailure(claimed.ok ? null : claimed.error);
    if (claimed.ok) onDone(t('tablet.highHand.claimed', { category: t(`tv.highHand.${values.category}`), seat: values.seat }));
  });
  return (
    <Stack gap={4}>
      <Heading level={3}>{t('tablet.highHand.title')}</Heading>
      <Controller control={form.control} name="category" render={({ field }) => (
        <ChoiceChips label={t('tablet.highHand.category')} mode="one" selected={[field.value]} options={CATEGORY_OPTIONS}
          onChange={(chosen) => { if (chosen[0] !== undefined) { field.onChange(chosen[0]); form.setValue('rank', null); } }} />
      )} />
      {category === 'four_of_a_kind' ? (
        <Controller control={form.control} name="rank" render={({ field }) => (
          <ChoiceChips label={t('tablet.highHand.rank')} mode="one" selected={field.value === null ? [] : [field.value]} options={RANK_OPTIONS}
            onChange={(chosen) => field.onChange(chosen[0] ?? null)} />
        )} />
      ) : null}
      <Controller control={form.control} name="seat" render={({ field }) => (
        <ChoiceChips label={t('tablet.highHand.seat')} mode="one" selected={[String(field.value)]} options={SEAT_OPTIONS}
          onChange={(chosen) => { if (chosen[0] !== undefined) field.onChange(Number(chosen[0])); }} />
      )} />
      {failure === null ? null : <ErrorMessage>{highHandFailureText(failure, seat)}</ErrorMessage>}
      <Inline gap={3}>
        <Button variant="primary" isLoading={claim.isPending} onClick={() => void submit()}>{t('tablet.highHand.submit')}</Button>
        <Button variant="text" onClick={() => onDone(null)}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}
