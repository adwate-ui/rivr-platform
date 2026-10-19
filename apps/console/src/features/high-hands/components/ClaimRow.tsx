import { zodResolver } from '@hookform/resolvers/zod';
import { highHandRejectSchema } from '@rivr/contracts';
import { useHighHandActions, type HighHand, type HighHandFailure } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { claimText, HIGH_HAND_FAILURE_COPY } from './highHandCopy.ts';

type Outcome = { ok: true } | { ok: false; error: HighHandFailure };

/** Rejects a claim with the reason. */
function RejectForm({ venueId, claimId, onDone }: { venueId: string; claimId: string; onDone: (outcome: Outcome | null) => void }) {
  const { reject } = useHighHandActions(venueId);
  const [resolver] = useState(() => zodResolver(highHandRejectSchema));
  const form = useForm<z.input<typeof highHandRejectSchema>, unknown, z.output<typeof highHandRejectSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => onDone(await reject.mutateAsync({ claimId, reason })));
  const reasonField = form.register('reason');
  return (
    <Inline gap={3} align="end">
      <Input {...reasonField} label={t('console.highHands.rejectReason')} autoComplete="off"
        error={form.formState.errors.reason ? t('console.highHands.invalidReason') : undefined} />
      <Button variant="danger" isLoading={reject.isPending} onClick={() => void submit()}>{t('console.highHands.rejectConfirm')}</Button>
      <Button variant="text" onClick={() => onDone(null)}>{t('common.cancel')}</Button>
    </Inline>
  );
}

/**
 * A claim waiting for the floor: what it is and what it pays now. Staff who approve jackpots pay it
 * (the amount shown, in chips at the table) or reject it with the reason; others only see it.
 */
export function ClaimRow({ venueId, hand, canDecide }: { venueId: string; hand: HighHand; canDecide: boolean }) {
  const { approve } = useHighHandActions(venueId);
  const [isRejecting, setIsRejecting] = useState(false);
  const [failure, setFailure] = useState<HighHandFailure | null>(null);
  const settle = (outcome: Outcome) => setFailure(outcome.ok ? null : outcome.error);
  const payout = hand.payout;
  const pay = async () => { if (payout !== null) settle(await approve.mutateAsync({ claimId: hand.claimId, payout })); };
  return (
    <Stack gap={3}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text weight="semibold">{claimText(hand)}</Text>
          <Text variant="small" tone="muted">
            {payout === null ? t('console.highHands.paysNothing') : t('console.highHands.pays', { amount: formatMoney(payout) })}
          </Text>
        </Stack>
        {canDecide ? (
          <Inline gap={2}>
            {payout === null ? null : (
              <Button variant="secondary" isLoading={approve.isPending} onClick={() => void pay()}>
                {t('console.highHands.approve', { amount: formatMoney(payout) })}
              </Button>
            )}
            <Button variant="text" onClick={() => setIsRejecting(true)}>{t('console.highHands.reject')}</Button>
          </Inline>
        ) : null}
      </Inline>
      {isRejecting ? (
        <RejectForm venueId={venueId} claimId={hand.claimId} onDone={(outcome) => {
          if (outcome !== null) settle(outcome);
          // A reject that did not go through keeps the form, and the reason typed in it.
          if (outcome === null || outcome.ok) setIsRejecting(false);
        }} />
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(HIGH_HAND_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
