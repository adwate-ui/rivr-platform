import { useHighHandActions, type HighHand, type HighHandFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { claimText, correctionText, decisionText, HIGH_HAND_FAILURE_COPY } from './highHandCopy.ts';
import { ClaimReasonForm } from './ClaimReasonForm.tsx';

/**
 * A decided claim: what it was, who decided and how, any correction, and any reversal. Staff who approve
 * jackpots reverse it with the reason (#324): what was paid is posted back, and the hand may be claimed again.
 */
export function HistoryRow({ venueId, hand, canDecide }: { venueId: string; hand: HighHand; canDecide: boolean }) {
  const { reverse } = useHighHandActions(venueId);
  const [isReversing, setIsReversing] = useState(false);
  const [failure, setFailure] = useState<HighHandFailure | null>(null);
  const submit = async (reason: string) => {
    const reversed = await reverse.mutateAsync({ claimId: hand.claimId, reason });
    setFailure(reversed.ok ? null : reversed.error);
    if (reversed.ok) setIsReversing(false);
  };
  return (
    <Stack gap={2}>
      <Inline gap={4} align="center" justify="between" wrap>
        <Stack gap={1}>
          <Text>{claimText(hand)}</Text>
          {hand.original === null ? null : <Text variant="small" tone="muted">{correctionText(hand)}</Text>}
          <Text variant="small" tone="muted">{decisionText(hand)}</Text>
          {hand.reversal === null ? null : (
            <Text variant="small">{t('console.highHands.reversedBy', { name: hand.reversal.byName, reason: hand.reversal.reason })}</Text>
          )}
        </Stack>
        {canDecide && hand.status !== 'reversed' && !isReversing ? (
          <Button variant="text" onClick={() => setIsReversing(true)}>{t('console.highHands.reverse')}</Button>
        ) : null}
      </Inline>
      {isReversing ? (
        <ClaimReasonForm label={t('console.highHands.reverseReason')} confirm={t('console.highHands.reverseConfirm')} isPending={reverse.isPending}
          onSubmit={submit} onCancel={() => setIsReversing(false)} />
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(HIGH_HAND_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
