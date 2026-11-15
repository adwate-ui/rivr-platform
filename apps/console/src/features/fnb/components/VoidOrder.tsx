import { zodResolver } from '@hookform/resolvers/zod';
import { cancelFnbOrderSchema } from '@rivr/contracts';
import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { ErrorMessage, ReasonForm, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Voids an order not yet delivered, with a reason the member sees (decision 0302), under the order's row once its Void is
 * pressed; Cancel, or the void going through, closes it.
 */
export function VoidForm({ venueId, order, onClose }: { venueId: string; order: FnbOrderTonight; onClose: () => void }) {
  const { cancel } = useServeFnbOrder(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const [resolver] = useState(() => zodResolver(cancelFnbOrderSchema));
  const form = useForm<z.input<typeof cancelFnbOrderSchema>, unknown, z.output<typeof cancelFnbOrderSchema>>({ resolver, defaultValues: { reason: '' } });
  const submit = form.handleSubmit(async ({ reason }) => {
    const done = await cancel.mutateAsync({ orderId: order.orderId, reason });
    setFailure(done.ok ? null : done.error);
    if (done.ok) onClose();
  });
  return (
    <Stack gap={2}>
      <ReasonForm field={form.register('reason')} label={t('console.fnb.voidReason', { kot: order.kotNumber })} hint={t('console.fnb.memberSeesReason')}
        error={form.formState.errors.reason ? t('console.fnb.invalidVoidReason') : undefined}
        actions={[{ label: t('console.fnb.voidConfirm'), onClick: () => void submit() }]} isLoading={cancel.isPending}
        onCancel={onClose} />
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
