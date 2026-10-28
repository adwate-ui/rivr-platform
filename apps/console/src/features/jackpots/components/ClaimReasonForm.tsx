import { zodResolver } from '@hookform/resolvers/zod';
import { highHandRejectSchema } from '@rivr/contracts';
import { t } from '@rivr/i18n';
import { ReasonForm } from '@rivr/ui';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

interface ClaimReasonFormProps {
  /** Asks for the reason: "Why it is not approved". */
  label: string;
  /** The decision button's label: "Reject the claim". */
  confirm: string;
  isPending: boolean;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * The reason for rejecting a claim, or for reversing a decided one (#324), and the button that does it.
 * `@rivr/ui`'s ReasonForm holds no state, so this keeps the form and the high-hands reason schema for
 * both uses; `onSubmit` gets the reason once the schema accepts it.
 */
export function ClaimReasonForm({ label, confirm, isPending, onSubmit, onCancel }: ClaimReasonFormProps) {
  const [resolver] = useState(() => zodResolver(highHandRejectSchema));
  const form = useForm<z.input<typeof highHandRejectSchema>, unknown, z.output<typeof highHandRejectSchema>>({
    resolver, defaultValues: { reason: '' },
  });
  // Opened by Reject or Reverse: the reason is the next thing to type.
  useEffect(() => form.setFocus('reason'), [form]);
  const submit = form.handleSubmit(async ({ reason }) => onSubmit(reason));
  return (
    <ReasonForm field={form.register('reason')} label={label}
      error={form.formState.errors.reason ? t('console.highHands.invalidReason') : undefined}
      actions={[{ label: confirm, onClick: () => void submit() }]} isLoading={isPending} onCancel={onCancel} />
  );
}
