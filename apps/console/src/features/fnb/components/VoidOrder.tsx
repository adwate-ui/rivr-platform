import { zodResolver } from '@hookform/resolvers/zod';
import { cancelFnbOrderSchema } from '@rivr/contracts';
import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Voids an order not yet delivered, with a reason the member sees (decision 0302), typed in the panel at the side once its
 * Void is pressed (redesign RD-38); Cancel, or the void going through, closes it.
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
  const field = form.register('reason');
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={cancel.isPending} onClick={() => void submit()}>{t('console.fnb.voidConfirm')}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onClose} title={t('console.fnb.voidName', { kot: order.kotNumber })} footer={footer}>
      <Stack gap={3}>
        <Input {...field} label={t('console.fnb.voidReason', { kot: order.kotNumber })} hint={t('console.fnb.memberSeesReason')} autoComplete="off" maxLength={300}
          error={form.formState.errors.reason ? t('console.fnb.invalidVoidReason') : undefined} />
        {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
