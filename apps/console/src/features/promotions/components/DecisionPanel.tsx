import { zodResolver } from '@hookform/resolvers/zod';
import { promotionRefusalSchema } from '@rivr/contracts';
import type { Result } from '@rivr/contracts/result';
import { usePromotionVersionActions, type PromotionVersionFailure, type PromotionVersionView } from '@rivr/db';
import { clubDay, clubDayMoment } from '@rivr/domain/clubDay';
import { transition, type Actor } from '@rivr/domain/promotions';
import { formatDate, t } from '@rivr/i18n';
import { Button, ErrorMessage, Grid, ReasonForm, Stack, Text, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/** Why it goes back, with the rule shown before it is sent: 3 to 300 characters, which the author reads. */
function RejectForm({ isPending, onReject, onCancel }: { isPending: boolean; onReject: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [resolver] = useState(() => zodResolver(promotionRefusalSchema));
  const form = useForm<z.input<typeof promotionRefusalSchema>, unknown, z.output<typeof promotionRefusalSchema>>({ resolver, defaultValues: { reason: '' } });
  const submit = form.handleSubmit(async ({ reason }) => onReject(reason));
  return (
    <ReasonForm field={form.register('reason')} label={t('console.promotions.review.rejectReason')} hint={t('console.promotions.review.rejectHint')}
      error={form.formState.errors.reason ? t('console.promotions.review.invalidReason') : undefined} maxLength={300}
      actions={[{ label: t('console.promotions.review.sendBack'), onClick: () => void submit() }]} isLoading={isPending} onCancel={onCancel} />
  );
}

interface DecisionPanelProps {
  venueId: string;
  waiting: PromotionVersionView;
  actor: Actor;
  /** Back to the list once it is decided. */
  onDone: () => void;
}

/** Approve and Reject on the waiting version, each said in a toast as the list opens again. */
function useDecision({ venueId, waiting, onDone }: DecisionPanelProps) {
  const { approve, reject } = usePromotionVersionActions(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<string | null>(null);
  const settle = (outcome: Result<null, PromotionVersionFailure>, said: string) => {
    setFailure(outcome.ok ? null : t(`console.promotions.failures.${outcome.error}`));
    if (!outcome.ok) return;
    toast(said);
    onDone();
  };
  return {
    failure, isApproving: approve.isPending, isRejecting: reject.isPending,
    approve: async (said: string) => settle(await approve.mutateAsync(waiting.id), said),
    reject: async (reason: string) => {
      const said = t('console.promotions.toast.sentBack', { name: waiting.terms?.name ?? '' });
      settle(await reject.mutateAsync({ versionId: waiting.id, reason }), said);
    },
  };
}

/** What approving does, by the status machine (decision 0437): live at once from its first day, scheduled before it. */
function approvalSaid(waiting: PromotionVersionView, actor: Actor): string | null {
  if (waiting.terms === null) return null;
  const state = { status: waiting.status, authorId: null, terms: waiting.terms, simulatedTerms: null };
  const approval = transition(state, { kind: 'approve', today: clubDay(new Date()) }, actor);
  if (!approval.ok) return null;
  const { name, schedule } = waiting.terms;
  if (approval.value.status === 'live') return t('console.promotions.toast.live', { name });
  return t('console.promotions.toast.scheduled', { name, date: formatDate(clubDayMoment(schedule.startsOn, '12:00')) });
}

/**
 * The approver's decision (four eyes, decision 0437): Approve, which the one who submitted or last changed the version never
 * has, saying why; and Reject, with the reason and its rule shown before it is sent. Staff without promotions.approve read
 * who approves it.
 */
export function DecisionPanel(props: DecisionPanelProps) {
  const { waiting, actor } = props;
  const decision = useDecision(props);
  const [isRejecting, setIsRejecting] = useState(false);
  if (!actor.permissions.includes('promotions.approve')) return <Text variant="secondary" tone="muted">{t('console.promotions.review.notApprover')}</Text>;
  const said = waiting.isMine ? null : approvalSaid(waiting, actor);
  const isBusy = decision.isApproving || decision.isRejecting;
  return (
    <Stack gap={3}>
      <Grid columns={2} gap={2}>
        <Button variant="subtle" size="compact" fullWidth isDisabled={isBusy} onClick={() => setIsRejecting(true)}>{t('console.promotions.review.reject')}</Button>
        <Button variant="primary" size="compact" fullWidth isDisabled={said === null || isBusy} isLoading={decision.isApproving}
          onClick={() => { if (said !== null) void decision.approve(said); }}>
          {t('console.promotions.review.approve')}
        </Button>
      </Grid>
      {waiting.isMine ? <Text variant="secondary" tone="muted">{t('console.promotions.review.yours')}</Text> : null}
      {isRejecting ? <RejectForm isPending={decision.isRejecting} onReject={decision.reject} onCancel={() => setIsRejecting(false)} /> : null}
      {decision.failure === null ? null : <ErrorMessage>{decision.failure}</ErrorMessage>}
    </Stack>
  );
}
