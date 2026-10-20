import { zodResolver } from '@hookform/resolvers/zod';
import { highHandRejectSchema } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { Button, Inline, Input } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

interface ReasonFormProps {
  label: string;
  confirm: string;
  isPending: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}

/** The reason for rejecting a claim, or for reversing a decided one (#324), and the button that does it. */
export function ReasonForm({ label, confirm, isPending, onSubmit, onCancel }: ReasonFormProps) {
  const [resolver] = useState(() => zodResolver(highHandRejectSchema));
  const form = useForm<z.input<typeof highHandRejectSchema>, unknown, z.output<typeof highHandRejectSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  const submit = form.handleSubmit(async ({ reason }) => onSubmit(reason));
  const reasonField = form.register('reason');
  return (
    <Inline gap={3} align="end">
      <Input {...reasonField} label={label} autoComplete="off"
        error={form.formState.errors.reason ? t('console.highHands.invalidReason') : undefined} />
      <Button variant="danger" isLoading={isPending} onClick={() => void submit()}>{confirm}</Button>
      <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>
    </Inline>
  );
}
