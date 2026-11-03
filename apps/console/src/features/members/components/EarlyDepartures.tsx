import { useMemberEarlyDepartures, useWithdrawEarlyDeparture, type EarlyDeparture, type EarlyDepartureFailure } from '@rivr/db';
import { formatDate, formatDuration, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, LoadState, ReasonForm, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

const FAILURE: Readonly<Record<EarlyDepartureFailure, MessageKey>> = {
  not_allowed: 'console.members.withdrawFailures.notAllowed',
  no_member: 'console.members.withdrawFailures.noMember',
  invalid: 'console.members.withdrawFailures.invalid',
  paused: 'console.members.withdrawFailures.paused',
  unavailable: 'console.members.withdrawFailures.unavailable',
  already_withdrawn: 'console.members.withdrawFailures.alreadyWithdrawn',
  member_frozen: 'console.members.withdrawFailures.memberFrozen',
};

function line(departure: EarlyDeparture): string {
  return t('console.members.earlyDeparture', {
    date: formatDate(new Date(departure.at)), time: formatDuration(departure.shortfallSeconds), reason: departure.reason, name: departure.staffName,
  });
}

interface WithdrawProps {
  readonly venueId: string;
  readonly memberId: string;
  readonly departure: EarlyDeparture;
  readonly onClose: () => void;
}

/** Why it is withdrawn, in words; the early departure stays on the record, marked withdrawn (decision 0500). */
function WithdrawForm({ venueId, memberId, departure, onClose }: WithdrawProps) {
  const withdraw = useWithdrawEarlyDeparture(venueId, memberId);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<EarlyDepartureFailure | null>(null);
  const date = formatDate(new Date(departure.at));
  const submit = async () => {
    const done = await withdraw.mutateAsync({ earlyDepartureId: departure.earlyDepartureId, reason });
    setFailure(done.ok ? null : done.error);
    if (done.ok) onClose();
  };
  return (
    <Stack gap={2}>
      <ReasonForm field={{ value: reason, onChange: (event) => setReason(event.target.value) }} label={t('console.members.withdrawReason', { date })}
        hint={t('console.members.withdrawHint')} maxLength={500} error={failure === 'invalid' ? t(FAILURE.invalid) : undefined}
        actions={[{ label: t('console.members.withdrawConfirm'), onClick: () => void submit() }]} isLoading={withdraw.isPending} onCancel={onClose} />
      {failure === null || failure === 'invalid' ? null : <ErrorMessage>{t(FAILURE[failure])}</ErrorMessage>}
    </Stack>
  );
}

/** One early departure: its line, and Withdraw for a super admin while it stands, or who withdrew it, when and why. */
function DepartureRow({ venueId, memberId, departure, canWithdraw }: Omit<WithdrawProps, 'onClose'> & { canWithdraw: boolean }) {
  const [isOpen, setOpen] = useState(false);
  const { withdrawn } = departure;
  return (
    <Stack gap={2}>
      <Inline gap={3} align="center" justify="between">
        {withdrawn === null ? <Text>{line(departure)}</Text> : <Text tone="muted">{line(departure)}</Text>}
        {canWithdraw && withdrawn === null && !isOpen ? (
          <Button variant="text" size="small" aria-label={t('console.members.withdrawNamed', { date: formatDate(new Date(departure.at)) })}
            onClick={() => setOpen(true)}>
            {t('console.members.withdraw')}
          </Button>
        ) : null}
      </Inline>
      {withdrawn === null ? null : (
        <Text variant="secondary" tone="muted">
          {t('console.members.earlyDepartureWithdrawn', { date: formatDate(new Date(withdrawn.at)), name: withdrawn.staffName, reason: withdrawn.reason })}
        </Text>
      )}
      {isOpen && withdrawn === null ? <WithdrawForm venueId={venueId} memberId={memberId} departure={departure} onClose={() => setOpen(false)} /> : null}
    </Stack>
  );
}

function Body({ venueId, memberId, canWithdraw }: { venueId: string; memberId: string; canWithdraw: boolean }) {
  const list = useMemberEarlyDepartures(venueId, memberId);
  if (list.isError) return <LoadState isError onRetry={() => void list.refetch()} />;
  if (list.data === undefined) return <LoadState />;
  if (list.data.length === 0) return <Text tone="muted">{t('console.members.noEarlyDepartures')}</Text>;
  return (
    <Stack gap={2} divided>
      {list.data.map((departure) => (
        <DepartureRow key={departure.earlyDepartureId} venueId={venueId} memberId={memberId} departure={departure} canWithdraw={canWithdraw} />
      ))}
    </Stack>
  );
}

/**
 * A member's early departures (#79, features "Call time"), newest first: when, the call time owed, why, and the admin who
 * let them go. A super admin withdraws one recorded by mistake, with a reason in words (decision 0500).
 */
export function EarlyDepartures({ venueId, memberId, canWithdraw }: { venueId: string; memberId: string; canWithdraw: boolean }) {
  return (
    <Stack gap={2}>
      <Heading level={3}>{t('console.members.earlyDeparturesTitle')}</Heading>
      <Body venueId={venueId} memberId={memberId} canWithdraw={canWithdraw} />
    </Stack>
  );
}
