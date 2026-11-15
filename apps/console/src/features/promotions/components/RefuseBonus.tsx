import { bonusRefusalSchema } from '@rivr/contracts';
import { useDecideBonus, type BonusDecisionFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';

const isReason = (reason: string) => bonusRefusalSchema.safeParse({ reason }).success;

/**
 * One reason for every Bonus chosen to refuse (decision 0670), typed in the panel at the side (redesign RD-38): nothing is
 * posted and the member is not told. The caller draws it only while Bonus is being refused; a retry is the same request.
 */
export function RefuseBonus({ venueId, ids, onDone, onCancel }: { venueId: string; ids: readonly string[]; onDone: () => void; onCancel: () => void }) {
  const decide = useDecideBonus(venueId);
  const toast = useToast();
  const [requestId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [isChecked, setChecked] = useState(false);
  const [failure, setFailure] = useState<BonusDecisionFailure | null>(null);
  const submit = async () => {
    setChecked(true);
    if (!isReason(reason)) return;
    const outcome = await decide.mutateAsync({ grantIds: ids, requestId, refusal: reason });
    setFailure(outcome.ok ? null : outcome.error);
    if (!outcome.ok) return;
    toast(outcome.value.grants === 0 ? t('console.promotions.approvals.alreadyDecided') : t('console.promotions.approvals.refused', { count: outcome.value.grants }));
    onDone();
  };
  const title = t('console.promotions.approvals.refuseTitle', { count: ids.length });
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onCancel}>{t('console.promotions.approvals.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={decide.isPending} onClick={() => void submit()}>{title}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onCancel} title={title} footer={footer}>
      <Stack gap={3}>
        <Input label={t('console.promotions.approvals.reason')} hint={t('console.promotions.approvals.reasonHint')} value={reason} maxLength={200}
          autoComplete="off" onChange={(event) => setReason(event.target.value)}
          error={isChecked && !isReason(reason) ? t('console.promotions.approvals.invalidReason') : undefined} />
        {failure === null ? null : <ErrorMessage>{t(`console.promotions.approvals.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
