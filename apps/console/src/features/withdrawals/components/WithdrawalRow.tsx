import { zodResolver } from '@hookform/resolvers/zod';
import { reasonForMemberSchema, utrEntrySchema } from '@rivr/contracts';
import { useWithdrawalDecisions, type WaitingWithdrawal, type WithdrawalFailure } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { accountLine, secondLine, WITHDRAWAL_FAILURE_COPY } from './withdrawalCopy.ts';

type Done = { ok: true; value: null } | { ok: false; error: WithdrawalFailure };

/** Sending: the bank's UTR, then Approve and send. */
function SendForm({ onSend, isSaving }: { onSend: (utr: string) => void; isSaving: boolean }) {
  const [resolver] = useState(() => zodResolver(utrEntrySchema));
  const form = useForm<z.input<typeof utrEntrySchema>, unknown, z.output<typeof utrEntrySchema>>({ resolver, defaultValues: { utr: '' } });
  const utr = form.register('utr');
  return (
    <Inline gap={3} align="end">
      <Input {...utr} label={t('console.withdrawals.utr')} inputMode="numeric" maxLength={12} autoComplete="off"
        error={form.formState.errors.utr ? t('console.withdrawals.utrInvalid') : undefined} />
      <Button variant="secondary" isLoading={isSaving} onClick={() => void form.handleSubmit((values) => onSend(values.utr))()}>
        {t('console.withdrawals.send')}
      </Button>
    </Inline>
  );
}

/** Declining: the reason the member reads, then Decline. */
function DeclineForm({ onDecline, isSaving }: { onDecline: (reason: string) => void; isSaving: boolean }) {
  const [resolver] = useState(() => zodResolver(reasonForMemberSchema));
  const form = useForm<z.input<typeof reasonForMemberSchema>, unknown, z.output<typeof reasonForMemberSchema>>({ resolver, defaultValues: { reason: '' } });
  const reason = form.register('reason');
  return (
    <Stack gap={2}>
      <Input {...reason} label={t('console.withdrawals.declineReason')} maxLength={200} autoComplete="off"
        error={form.formState.errors.reason ? t('console.withdrawals.reasonInvalid') : undefined} />
      <Button variant="danger" isLoading={isSaving} onClick={() => void form.handleSubmit((values) => onDecline(values.reason))()}>
        {t('console.withdrawals.decline')}
      </Button>
    </Stack>
  );
}

export interface WithdrawalRowProps {
  venueId: string;
  withdrawal: WaitingWithdrawal;
  /** Whether the signed-in staff member sends and declines (withdrawals.approve), and approves as second (cage.second_approve). */
  canDecide: boolean;
  canSecond: boolean;
  onSent: (utr: string) => void;
}

/**
 * One waiting withdrawal (design prompt flow 9): whose, how much, to which account and when; the second
 * approver's state; and, by role, Approve as second approver, the UTR with Approve and send, or Decline.
 */
export function WithdrawalRow({ venueId, withdrawal, canDecide, canSecond, onSent }: WithdrawalRowProps) {
  const { secondApprove, send, decline } = useWithdrawalDecisions(venueId);
  const [isDeclining, setIsDeclining] = useState(false);
  const [failure, setFailure] = useState<WithdrawalFailure | null>(null);
  const settle = (done: Done, then?: () => void) => { setFailure(done.ok ? null : done.error); if (done.ok) then?.(); };
  const second = secondLine(withdrawal);
  const id = withdrawal.withdrawalId;
  return (
    <Stack gap={3}>
      <Inline gap={4} align="start" justify="between">
        <Stack gap={1}>
          <Text weight="medium">{withdrawal.fullName}</Text>
          <Text>{accountLine(withdrawal)}</Text>
          <Text variant="small" tone="muted">{t('console.withdrawals.requested', { time: formatDayTime(new Date(withdrawal.requestedAt)) })}</Text>
          {second === null ? null : <Text variant="small" tone="muted">{second}</Text>}
        </Stack>
        <Money paise={withdrawal.amount} size="lead" />
      </Inline>
      <Inline gap={3} align="end" wrap>
        {canDecide ? <SendForm isSaving={send.isPending} onSend={(utr) => void send.mutateAsync({ withdrawalId: id, utr }).then((done) => settle(done, () => onSent(utr)))} /> : null}
        {canSecond && withdrawal.needsSecond ? (
          <Button variant="secondary" isLoading={secondApprove.isPending} onClick={() => void secondApprove.mutateAsync(id).then((done) => settle(done))}>
            {t('console.withdrawals.secondApprove')}
          </Button>
        ) : null}
        {canDecide ? <Button variant="text" onClick={() => setIsDeclining((open) => !open)}>{t('console.withdrawals.decline')}</Button> : null}
      </Inline>
      {isDeclining ? <DeclineForm isSaving={decline.isPending} onDecline={(reason) => void decline.mutateAsync({ withdrawalId: id, reason }).then((done) => settle(done))} /> : null}
      {failure === null ? null : <ErrorMessage>{t(WITHDRAWAL_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
