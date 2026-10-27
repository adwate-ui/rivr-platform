import { zodResolver } from '@hookform/resolvers/zod';
import { promotionRefusalSchema } from '@rivr/contracts';
import type { Result } from '@rivr/contracts/result';
import { usePromotionDecisions, usePromotionsAwaitingApproval, type PromotionAwaitingApproval, type PromotionFailure, type PromotionStake } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, ReasonForm, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { approvalLines } from './promotionRule.ts';

/** How a decision went, said at the list's head: the row itself goes once decided. */
interface Outcome {
  readonly ok: boolean;
  readonly text: string;
}

/** Why the promotion is refused, and Refuse: `onRefuse` gets the reason once the schema accepts it. */
function RefuseForm({ isPending, onRefuse, onCancel }: { isPending: boolean; onRefuse: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [resolver] = useState(() => zodResolver(promotionRefusalSchema));
  const form = useForm<z.input<typeof promotionRefusalSchema>, unknown, z.output<typeof promotionRefusalSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => onRefuse(reason));
  return (
    <ReasonForm field={form.register('reason')} label={t('console.promotions.awaiting.refuseReason')} hint={t('console.promotions.awaiting.refuseHint')}
      error={form.formState.errors.reason ? t('console.promotions.awaiting.invalidReason') : undefined} maxLength={300}
      actions={[{ label: t('console.promotions.awaiting.refuse'), onClick: () => void submit() }]} isLoading={isPending} onCancel={onCancel} />
  );
}

/** Approve and refuse for one waiting promotion; how it went goes up to the list. */
function useDecision(venueId: string, promotion: PromotionAwaitingApproval, onOutcome: (outcome: Outcome) => void) {
  const { approve, refuse } = usePromotionDecisions(venueId);
  const settle = (result: Result<null, PromotionFailure>, done: 'approved' | 'refused') =>
    onOutcome(result.ok
      ? { ok: true, text: t(`console.promotions.awaiting.${done}`, { name: promotion.name }) }
      : { ok: false, text: t(`console.promotions.failures.${result.error}`) });
  return {
    isApproving: approve.isPending, isRefusing: refuse.isPending,
    approve: async () => settle(await approve.mutateAsync(promotion.id), 'approved'),
    refuse: async (reason: string) => settle(await refuse.mutateAsync({ id: promotion.id, reason }), 'refused'),
  };
}

/** What it actually does, from its stored rules; when those cannot be read, only Refuse is offered. */
function WhatItDoes({ lines }: { lines: readonly string[] | null }) {
  if (lines === null) return <ErrorMessage>{t('console.promotions.awaiting.unreadable')}</ErrorMessage>;
  return (
    <Stack gap={1}>
      <Text variant="small" weight="medium">{t('console.promotions.awaiting.does')}</Text>
      {lines.map((line, index) => <Text key={index} variant="small">{line}</Text>)}
    </Stack>
  );
}

interface RowProps {
  venueId: string;
  promotion: PromotionAwaitingApproval;
  stakes: readonly PromotionStake[];
  /** A super admin, who approves or refuses another's promotion. */
  mayApprove: boolean;
  onOutcome: (outcome: Outcome) => void;
}

function AwaitingRow({ venueId, promotion, stakes, mayApprove, onOutcome }: RowProps) {
  const decision = useDecision(venueId, promotion, onOutcome);
  const [isRefusing, setIsRefusing] = useState(false);
  const nameId = useId();
  const words = [promotion.detail, promotion.runs].filter((part) => part !== null).join(' · ');
  const lines = approvalLines(promotion, stakes);
  const decides = mayApprove && !promotion.isMine;
  return (
    <Stack gap={2}>
      <Inline justify="between" align="start" gap={6}>
        <Stack gap={1} grow>
          <Text weight="medium" id={nameId}>{promotion.name}</Text>
          {words === '' ? null : <Text variant="small" tone="muted">{words}</Text>}
          <Text variant="small" tone="muted">
            {t('console.promotions.awaiting.submittedBy', { name: promotion.requestedBy, time: formatDayTime(new Date(promotion.requestedAt)) })}
          </Text>
          <WhatItDoes lines={lines} />
        </Stack>
        {decides ? (
          <Inline gap={2}>
            <Button variant="text" isDisabled={decision.isApproving} onClick={() => setIsRefusing(true)} aria-describedby={nameId}>
              {t('console.promotions.awaiting.refuse')}
            </Button>
            {lines === null ? null : (
              <Button variant="primary" isLoading={decision.isApproving} onClick={() => void decision.approve()} aria-describedby={nameId}>
                {t('console.promotions.awaiting.approve')}
              </Button>
            )}
          </Inline>
        ) : (
          <Text variant="small" tone="muted">{t(mayApprove ? 'console.promotions.awaiting.yours' : 'console.promotions.awaiting.waiting')}</Text>
        )}
      </Inline>
      {decides && isRefusing ? <RefuseForm isPending={decision.isRefusing} onRefuse={decision.refuse} onCancel={() => setIsRefusing(false)} /> : null}
    </Stack>
  );
}

interface AwaitingApprovalProps {
  venueId: string;
  mayApprove: boolean;
  /** The venue's stakes, to name a rule's stakes as the builder does. */
  stakes: readonly PromotionStake[];
}

/**
 * Promotions waiting for a super admin (#144; decision 0244), oldest first, with who submitted each and what each
 * actually does, in words made from its stored rule. A super admin approves or refuses another's; the one who
 * submitted it, and staff who are not super admins, see it waiting. Nothing shows when none waits and nothing was
 * just decided.
 */
export function AwaitingApproval({ venueId, mayApprove, stakes }: AwaitingApprovalProps) {
  const awaiting = usePromotionsAwaitingApproval(venueId);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const heading = <Heading level={2} variant="section">{t('console.promotions.awaiting.heading')}</Heading>;
  if (awaiting.data === undefined) {
    return (
      <Stack gap={4}>
        {heading}
        <Text tone="muted">{t(awaiting.isError ? 'common.loadFailed' : 'common.loading')}</Text>
        {awaiting.isError ? <Inline><Button onClick={() => void awaiting.refetch()}>{t('common.retry')}</Button></Inline> : null}
      </Stack>
    );
  }
  if (awaiting.data.length === 0 && outcome === null) return null;
  return (
    <Stack gap={4}>
      {heading}
      {outcome === null ? null : outcome.ok ? <Text>{outcome.text}</Text> : <ErrorMessage>{outcome.text}</ErrorMessage>}
      <Stack gap={4} divided>
        {awaiting.data.map((promotion) => (
          <AwaitingRow key={promotion.id} venueId={venueId} promotion={promotion} stakes={stakes} mayApprove={mayApprove} onOutcome={setOutcome} />
        ))}
      </Stack>
    </Stack>
  );
}
