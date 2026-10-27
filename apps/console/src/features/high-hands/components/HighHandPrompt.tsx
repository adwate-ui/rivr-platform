import { useHighHandActions, type HighHand, type HighHandFailure } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, PromptBar } from '@rivr/ui';
import { useState } from 'react';
import { ClaimReasonForm } from './ClaimReasonForm.tsx';
import { HIGH_HAND_FAILURE_COPY, promptText } from './highHandCopy.ts';

interface HighHandPromptProps {
  venueId: string;
  /** The claim to decide: the oldest waiting. */
  hand: HighHand;
  /** How many wait in all, this one included. */
  waiting: number;
  /** Opens the High hands screen, for the others. */
  onSeeAll: () => void;
}

/**
 * The floor's prompt for a high-hand claim (#317; design prompt flow 6), on every console screen but High hands, for
 * staff who approve jackpots: the oldest claim waiting, which they approve at the amount shown or reject with the
 * reason, as on the High hands screen, and the way there when more wait.
 */
export function HighHandPrompt({ venueId, hand, waiting, onSeeAll }: HighHandPromptProps) {
  const { approve, reject } = useHighHandActions(venueId);
  const [isRejecting, setIsRejecting] = useState(false);
  const [failure, setFailure] = useState<HighHandFailure | null>(null);
  const payout = hand.payout;
  const settle = (outcome: { ok: true } | { ok: false; error: HighHandFailure }) => setFailure(outcome.ok ? null : outcome.error);
  const pay = async () => { if (payout !== null) settle(await approve.mutateAsync({ claimId: hand.claimId, payout })); };
  const actions = (
    <>
      {payout === null ? null : (
        <Button variant="secondary" isLoading={approve.isPending} onClick={() => void pay()}>
          {t('console.highHands.approve', { amount: formatMoney(payout) })}
        </Button>
      )}
      <Button variant="text" onClick={() => setIsRejecting(true)}>{t('console.highHands.reject')}</Button>
      {waiting > 1 ? <Button variant="text" onClick={onSeeAll}>{t('console.highHands.promptSeeAll', { count: waiting })}</Button> : null}
    </>
  );
  return (
    <PromptBar message={promptText(hand)} actions={actions}>
      {isRejecting ? (
        <ClaimReasonForm label={t('console.highHands.rejectReason')} confirm={t('console.highHands.rejectConfirm')} isPending={reject.isPending}
          onSubmit={async (reason) => settle(await reject.mutateAsync({ claimId: hand.claimId, reason }))} onCancel={() => setIsRejecting(false)} />
      ) : null}
      {failure === null ? null : <ErrorMessage>{t(HIGH_HAND_FAILURE_COPY[failure])}</ErrorMessage>}
    </PromptBar>
  );
}
