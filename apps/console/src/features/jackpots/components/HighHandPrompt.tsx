import type { Permission } from '@rivr/contracts';
import { useHighHandActions, useWaitingHighHands, type HighHand, type HighHandFailure } from '@rivr/db';
import { formatMoney, t } from '@rivr/i18n';
import { Button, ErrorMessage, PromptBar } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
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
      <Button variant="text" isDisabled={approve.isPending} onClick={() => setIsRejecting(true)}>{t('console.highHands.reject')}</Button>
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

/**
 * The prompt the console's frame puts across the top of every screen (#317): the oldest claim waiting, for staff who
 * approve jackpots, on every screen but Jackpots' High hands tab, which lists them all.
 */
export function WaitingHighHandPrompt({ venueId, permissions, pathname, search }: {
  venueId: string;
  permissions: readonly Permission[];
  pathname: string;
  search: string;
}) {
  const navigate = useNavigate();
  const waiting = useWaitingHighHands(venueId, permissions.includes('jackpots.approve'));
  const isOnClaims = pathname.toLowerCase().startsWith('/jackpots') && new URLSearchParams(search).get('tab') === 'highHands';
  const oldest = isOnClaims ? undefined : waiting.at(-1);
  if (oldest === undefined) return null;
  return <HighHandPrompt key={oldest.claimId} venueId={venueId} hand={oldest} waiting={waiting.length} onSeeAll={() => void navigate({ to: '/jackpots', search: { tab: 'highHands' } })} />;
}
