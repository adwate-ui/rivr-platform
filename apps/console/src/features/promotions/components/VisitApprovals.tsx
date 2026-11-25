import { useDecideVisit, useVisitsWaiting, type AddVisitFailure, type WaitingVisitAdd } from '@rivr/db';
import { formatDate, formatTime, t } from '@rivr/i18n';
import { Button, ConfirmButton, ErrorMessage, Inline, LoadState, ReasonForm, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';

/** The waiting visit in one line: whose, the night, the times and the table. */
function lineOf(visit: WaitingVisitAdd): string {
  const openedAt = new Date(visit.openedAt);
  return t('console.members.visitsAdded.approvals.line', {
    name: visit.fullName, number: String(visit.memberNumber), date: formatDate(openedAt), from: formatTime(openedAt),
    to: formatTime(new Date(visit.closedAt)), table: visit.tableName,
  });
}

/** Refusing a waiting visit: why, in 3 to 200 characters, then Refuse visit; Cancel gives the focus back to Refuse. */
function RefuseForm({ isBusy, onRefuse, onCancel }: { isBusy: boolean; onRefuse: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [isShort, setIsShort] = useState(false);
  const refuse = () => {
    setIsShort(reason.trim().length < 3);
    if (reason.trim().length >= 3) onRefuse(reason);
  };
  return (
    <ReasonForm field={{ value: reason, onChange: (event) => { setReason(event.target.value); setIsShort(false); } }} variant="secondary"
      label={t('console.members.visitsAdded.approvals.refusal')} hint={t('console.members.visitsAdded.reasonHint')} maxLength={200}
      error={isShort ? t('console.members.visitsAdded.failures.invalid') : undefined} isLoading={isBusy} onCancel={onCancel}
      actions={[{ label: t('console.members.visitsAdded.approvals.confirmRefuse'), onClick: refuse }]} />
  );
}

/** One waiting visit: Approve, asked twice; or Refuse, with why. */
function WaitingLine({ venueId, visit }: { venueId: string; visit: WaitingVisitAdd }) {
  const decide = useDecideVisit(venueId);
  const toast = useToast();
  const [isRefusing, setIsRefusing] = useState(false);
  const [failure, setFailure] = useState<AddVisitFailure | null>(null);
  const send = async (isApproved: boolean, reason?: string) => {
    const done = await decide.mutateAsync({ request: visit, isApproved, ...(reason === undefined ? {} : { reason }) });
    if (!done.ok) return setFailure(done.error);
    return toast(t(isApproved ? 'console.members.visitsAdded.approvals.approved' : 'console.members.visitsAdded.approvals.refused', { name: visit.fullName }));
  };
  const named = { name: visit.fullName };
  return (
    <Stack gap={2}>
      <Text>{lineOf(visit)}</Text>
      <Text variant="small" tone="muted">{t('console.members.visitsAdded.approvals.why', { reason: visit.reason, who: visit.requestedBy })}</Text>
      {isRefusing ? <RefuseForm isBusy={decide.isPending} onRefuse={(reason) => void send(false, reason)} onCancel={() => setIsRefusing(false)} /> : (
        <Inline gap={3}>
          <ConfirmButton variant="subtle" size="compact" label={t('console.members.visitsAdded.approvals.approve')}
            name={t('console.members.visitsAdded.approvals.approveNamed', named)} isBusy={decide.isPending}
            confirm={t('console.members.visitsAdded.approvals.confirmApprove')} onConfirm={() => void send(true)} />
          <Button variant="text" size="compact" aria-label={t('console.members.visitsAdded.approvals.refuseNamed', named)} onClick={() => setIsRefusing(true)}>
            {t('console.members.visitsAdded.approvals.refuse')}
          </Button>
        </Inline>
      )}
      {failure === null ? null : <ErrorMessage>{t(`console.members.visitsAdded.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * The visits the floor and admins added, waiting for a super admin (the owner, 25 Nov; #1134), oldest asked first: each
 * approved, when it counts like a real visit, or refused with why, which the member's record then says.
 */
export function VisitApprovals({ venueId }: { venueId: string }) {
  const waiting = useVisitsWaiting(venueId);
  if (waiting.isError) return <LoadState isError onRetry={() => void waiting.refetch()} />;
  if (waiting.data === undefined) return <LoadState />;
  if (waiting.data.length === 0) return <Text tone="muted">{t('console.members.visitsAdded.approvals.none')}</Text>;
  return (
    <Stack as="section" aria-label={t('console.members.visitsAdded.approvals.label')} gap={4} divided>
      {waiting.data.map((visit) => <WaitingLine key={visit.requestId} venueId={venueId} visit={visit} />)}
    </Stack>
  );
}
