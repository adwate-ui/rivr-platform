import { zodResolver } from '@hookform/resolvers/zod';
import { promotionRefusalSchema } from '@rivr/contracts';
import { usePromotionDecisions, usePromotionsAwaitingApproval, type PromotionAwaitingApproval, type PromotionFailure } from '@rivr/db';
import type { Result } from '@rivr/contracts/result';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, ReasonForm, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

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

interface RowProps {
  venueId: string;
  promotion: PromotionAwaitingApproval;
  /** A super admin, who approves or refuses another's promotion. */
  mayApprove: boolean;
  onDecided: (text: string) => void;
}

/** Approve and refuse for one waiting promotion: what was decided goes up to the list, a failure stays on the row. */
function useDecision(venueId: string, promotion: PromotionAwaitingApproval, onDecided: (text: string) => void) {
  const { approve, refuse } = usePromotionDecisions(venueId);
  const [failure, setFailure] = useState<string | null>(null);
  const settle = (result: Result<null, PromotionFailure>, done: 'approved' | 'refused') =>
    result.ok ? onDecided(t(`console.promotions.awaiting.${done}`, { name: promotion.name })) : setFailure(t(`console.promotions.failures.${result.error}`));
  return {
    failure, isApproving: approve.isPending, isRefusing: refuse.isPending,
    approve: async () => settle(await approve.mutateAsync(promotion.id), 'approved'),
    refuse: async (reason: string) => settle(await refuse.mutateAsync({ id: promotion.id, reason }), 'refused'),
  };
}

function AwaitingRow({ venueId, promotion, mayApprove, onDecided }: RowProps) {
  const decision = useDecision(venueId, promotion, onDecided);
  const [isRefusing, setIsRefusing] = useState(false);
  const nameId = useId();
  const line = [promotion.detail, promotion.runs].filter((part) => part !== null).join(' · ');
  const decides = mayApprove && !promotion.isMine;
  return (
    <Stack gap={2}>
      <Inline justify="between" align="center" gap={6}>
        <Stack gap={1} grow>
          <Text weight="medium" id={nameId}>{promotion.name}</Text>
          {line === '' ? null : <Text variant="small" tone="muted">{line}</Text>}
          <Text variant="small" tone="muted">
            {t('console.promotions.awaiting.submittedBy', { name: promotion.requestedBy, time: formatDayTime(new Date(promotion.requestedAt)) })}
          </Text>
        </Stack>
        {decides ? (
          <Inline gap={2}>
            <Button variant="text" isDisabled={decision.isApproving} onClick={() => setIsRefusing(true)} aria-describedby={nameId}>
              {t('console.promotions.awaiting.refuse')}
            </Button>
            <Button variant="primary" isLoading={decision.isApproving} onClick={() => void decision.approve()} aria-describedby={nameId}>
              {t('console.promotions.awaiting.approve')}
            </Button>
          </Inline>
        ) : (
          <Text variant="small" tone="muted">{t(mayApprove ? 'console.promotions.awaiting.yours' : 'console.promotions.awaiting.waiting')}</Text>
        )}
      </Inline>
      {decides && isRefusing ? <RefuseForm isPending={decision.isRefusing} onRefuse={decision.refuse} onCancel={() => setIsRefusing(false)} /> : null}
      {decision.failure === null ? null : <ErrorMessage>{decision.failure}</ErrorMessage>}
    </Stack>
  );
}

/**
 * Promotions waiting for a super admin (#144; decision 0244), oldest first, with who submitted each. A super admin
 * approves or refuses another's; the one who submitted it, and staff who are not super admins, see it waiting.
 * Nothing shows when none waits and nothing was just decided.
 */
export function AwaitingApproval({ venueId, mayApprove }: { venueId: string; mayApprove: boolean }) {
  const awaiting = usePromotionsAwaitingApproval(venueId);
  const [decided, setDecided] = useState<string | null>(null);
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
  if (awaiting.data.length === 0 && decided === null) return null;
  return (
    <Stack gap={4}>
      {heading}
      {decided === null ? null : <Text>{decided}</Text>}
      <Stack gap={4} divided>
        {awaiting.data.map((promotion) => (
          <AwaitingRow key={promotion.id} venueId={venueId} promotion={promotion} mayApprove={mayApprove} onDecided={setDecided} />
        ))}
      </Stack>
    </Stack>
  );
}
