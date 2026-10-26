import { zodResolver } from '@hookform/resolvers/zod';
import { HIGH_HAND_CATEGORIES, HIGH_HAND_RANKS, highHandClaimSchema } from '@rivr/contracts';
import { useHighHandActions, type HighHand, type HighHandFailure } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { claimText, correctionText, HIGH_HAND_FAILURE_COPY } from './highHandCopy.ts';
import { ClaimReasonForm } from './ClaimReasonForm.tsx';

type Outcome = { ok: true } | { ok: false; error: HighHandFailure };

const HANDS = HIGH_HAND_CATEGORIES.map((value) => ({ value, label: t(`tv.highHand.${value}`) }));
const RANKS = HIGH_HAND_RANKS.map((value) => ({ value, label: t(`tv.ranks.${value}`) }));

/** Corrects a waiting claim's hand, rank and seat before the floor decides it (#324); the dealer's claim is kept. */
function CorrectForm({ venueId, hand, onDone }: { venueId: string; hand: HighHand; onDone: (outcome: Outcome | null) => void }) {
  const { correct } = useHighHandActions(venueId);
  const [resolver] = useState(() => zodResolver(highHandClaimSchema));
  const form = useForm<z.input<typeof highHandClaimSchema>, unknown, z.output<typeof highHandClaimSchema>>({
    resolver, defaultValues: { category: hand.category, rank: HIGH_HAND_RANKS.find((known) => known === hand.rank) ?? null, seat: hand.seat },
  });
  const submit = form.handleSubmit(async (claim) => onDone(await correct.mutateAsync({ claimId: hand.claimId, ...claim })));
  const seatField = form.register('seat', { valueAsNumber: true });
  const isInvalid = form.formState.errors.seat !== undefined || form.formState.errors.rank !== undefined;
  const category = useWatch({ control: form.control, name: 'category' });
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="category" render={({ field }) => (
        <ChoiceChips label={t('console.highHands.correctHand')} mode="one" options={HANDS} selected={[field.value]} onChange={([picked]) => {
          if (picked === undefined) return;
          field.onChange(picked);
          // Only a four of a kind has a rank.
          if (picked !== 'four_of_a_kind') form.setValue('rank', null);
        }} />
      )} />
      {category === 'four_of_a_kind' ? (
        <Controller control={form.control} name="rank" render={({ field }) => (
          <ChoiceChips label={t('console.highHands.correctRank')} mode="one" options={RANKS} selected={field.value === null ? [] : [field.value]}
            onChange={([picked]) => field.onChange(picked ?? null)} />
        )} />
      ) : null}
      <Inline gap={3} align="end">
        <Input {...seatField} label={t('console.highHands.correctSeat')} inputMode="numeric" autoComplete="off"
          error={isInvalid ? t('console.highHands.invalidCorrection') : undefined} />
        <Button variant="secondary" isLoading={correct.isPending} onClick={() => void submit()}>{t('console.highHands.correctConfirm')}</Button>
        <Button variant="text" onClick={() => onDone(null)}>{t('common.cancel')}</Button>
      </Inline>
    </Stack>
  );
}

/** Approve, correct and reject, for staff who approve jackpots. */
function Decisions({ venueId, hand, onOpen, onOutcome }: {
  venueId: string; hand: HighHand; onOpen: (form: 'reject' | 'correct') => void; onOutcome: (outcome: Outcome) => void;
}) {
  const { approve } = useHighHandActions(venueId);
  const payout = hand.payout;
  const pay = async () => { if (payout !== null) onOutcome(await approve.mutateAsync({ claimId: hand.claimId, payout })); };
  return (
    <Inline gap={2}>
      {payout === null ? null : (
        <Button variant="secondary" isLoading={approve.isPending} onClick={() => void pay()}>
          {t('console.highHands.approve', { amount: formatMoney(payout) })}
        </Button>
      )}
      <Button variant="text" onClick={() => onOpen('correct')}>{t('console.highHands.correct')}</Button>
      <Button variant="text" onClick={() => onOpen('reject')}>{t('console.highHands.reject')}</Button>
    </Inline>
  );
}

/**
 * A claim waiting for the floor: what it is (and what the dealer claimed, if the floor corrected it) and
 * what it pays now. Staff who approve jackpots pay it (the amount shown, in chips at the table), correct
 * it, or reject it with the reason; others only see it.
 */
export function ClaimRow({ venueId, hand, canDecide }: { venueId: string; hand: HighHand; canDecide: boolean }) {
  const { reject } = useHighHandActions(venueId);
  const [form, setForm] = useState<'reject' | 'correct' | null>(null);
  const [failure, setFailure] = useState<HighHandFailure | null>(null);
  const settle = (outcome: Outcome) => setFailure(outcome.ok ? null : outcome.error);
  // A form whose change did not go through stays open, with what was typed in it.
  const done = (outcome: Outcome | null) => {
    if (outcome !== null) settle(outcome);
    if (outcome === null || outcome.ok) setForm(null);
  };
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text weight="semibold">{claimText(hand)}</Text>
          {hand.original === null ? null : <Text variant="small" tone="muted">{correctionText(hand)}</Text>}
          <Text variant="small" tone="muted">
            {hand.payout === null ? t('console.highHands.paysNothing') : t('console.highHands.pays', { amount: formatMoney(hand.payout) })}
          </Text>
        </Stack>
        {canDecide ? <Decisions venueId={venueId} hand={hand} onOpen={setForm} onOutcome={settle} /> : null}
      </Inline>
      {form === 'correct' ? <CorrectForm venueId={venueId} hand={hand} onDone={done} /> : null}
      {form === 'reject' ? (
        <ClaimReasonForm label={t('console.highHands.rejectReason')} confirm={t('console.highHands.rejectConfirm')} isPending={reject.isPending}
          onSubmit={async (reason) => done(await reject.mutateAsync({ claimId: hand.claimId, reason }))} onCancel={() => done(null)} />
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(HIGH_HAND_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
