import { zodResolver } from '@hookform/resolvers/zod';
import { cancelFnbOrderSchema } from '@rivr/contracts';
import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, ReasonForm, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/** Voids an order not yet delivered, with a reason the member sees, after Void opens the form (decision 0302); the form's Cancel closes it. */
export function VoidOrder({ venueId, order }: { venueId: string; order: FnbOrderTonight }) {
  const { cancel } = useServeFnbOrder(venueId);
  const [isOpen, setIsOpen] = useState(false);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const [resolver] = useState(() => zodResolver(cancelFnbOrderSchema));
  const form = useForm<z.input<typeof cancelFnbOrderSchema>, unknown, z.output<typeof cancelFnbOrderSchema>>({ resolver, defaultValues: { reason: '' } });
  const submit = form.handleSubmit(async ({ reason }) => {
    const done = await cancel.mutateAsync({ orderId: order.orderId, reason });
    setFailure(done.ok ? null : done.error);
  });
  if (!isOpen) {
    return (
      <Button variant="text" aria-label={t('console.fnb.voidName', { kot: order.kotNumber })} onClick={() => setIsOpen(true)}>
        {t('console.fnb.void')}
      </Button>
    );
  }
  return (
    <Stack gap={2}>
      <ReasonForm field={form.register('reason')} label={t('console.fnb.voidReason', { kot: order.kotNumber })} hint={t('console.fnb.memberSeesReason')}
        error={form.formState.errors.reason ? t('console.fnb.invalidVoidReason') : undefined}
        actions={[{ label: t('console.fnb.voidConfirm'), onClick: () => void submit() }]} isLoading={cancel.isPending}
        onCancel={() => setIsOpen(false)} />
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
