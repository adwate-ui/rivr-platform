import { useWithdrawalDecisions, type WaitingWithdrawal, type WithdrawalFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Text } from '@rivr/ui';

type Done = { ok: true; value: null } | { ok: false; error: WithdrawalFailure };

interface PayChoicesProps {
  readonly venueId: string;
  readonly withdrawal: WaitingWithdrawal;
  /** Whether the signed-in staff member pays withdrawals (withdrawals.approve). */
  readonly canDecide: boolean;
  readonly onDone: (done: Done) => void;
}

/** The other ways to pay (#475): in cash from the drawer, or through Cashfree to a UPI address. */
export function PayChoices({ venueId, withdrawal, canDecide, onDone }: PayChoicesProps) {
  const { payInCash, payThroughCashfree } = useWithdrawalDecisions(venueId);
  if (!canDecide) return null;
  const id = withdrawal.withdrawalId;
  return (
    <>
      <Button variant="secondary" isLoading={payInCash.isPending} onClick={() => void payInCash.mutateAsync(id).then(onDone)}>
        {t('console.withdrawals.payInCash')}
      </Button>
      {withdrawal.kind === 'upi' ? (
        <Button variant="secondary" isLoading={payThroughCashfree.isPending} onClick={() => void payThroughCashfree.mutateAsync(id).then(onDone)}>
          {t('console.withdrawals.payThroughCashfree')}
        </Button>
      ) : null}
    </>
  );
}

/** A Cashfree payout on its way, or the last one's failure, under the withdrawal. */
export function PayoutNote({ withdrawal }: { withdrawal: WaitingWithdrawal }) {
  if (withdrawal.status === 'paying') return <Text tone="muted">{t('console.withdrawals.paying')}</Text>;
  if (withdrawal.payoutFailure === null) return null;
  return <ErrorMessage>{t('console.withdrawals.payoutFailed', { reason: withdrawal.payoutFailure })}</ErrorMessage>;
}
