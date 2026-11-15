import { zodResolver } from '@hookform/resolvers/zod';
import { feedbackResolveSchema } from '@rivr/contracts';
import { useResolveFeedback, type ResolveFeedbackFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Sheet, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/**
 * One line of what was done, for every ticket ticked (F-013), typed in the panel at the side (redesign RD-38); the lists
 * then show them resolved, with the staff member's name. The caller draws it only while tickets are being resolved.
 */
export function ResolveTickets({ venueId, ids, onDone, onCancel }: { venueId: string; ids: readonly string[]; onDone: () => void; onCancel: () => void }) {
  const resolve = useResolveFeedback(venueId);
  const toast = useToast();
  const [failure, setFailure] = useState<ResolveFeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(feedbackResolveSchema));
  const form = useForm<z.input<typeof feedbackResolveSchema>, unknown, z.output<typeof feedbackResolveSchema>>({
    resolver, defaultValues: { resolution: '' },
  });
  const submit = form.handleSubmit(async ({ resolution }) => {
    const outcome = await resolve.mutateAsync({ feedbackIds: ids, resolution });
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) {
      toast(t('console.feedback.resolvedCount', { count: ids.length }));
      onDone();
    }
  });
  const field = form.register('resolution');
  const title = t('console.feedback.resolveCount', { count: ids.length });
  const footer = (
    <Inline gap={2} justify="end">
      <Button variant="text" size="compact" onClick={onCancel}>{t('console.feedback.cancel')}</Button>
      <Button variant="primary" size="compact" isLoading={resolve.isPending} onClick={() => void submit()}>{title}</Button>
    </Inline>
  );
  return (
    <Sheet place="console" isOpen onClose={onCancel} title={title} footer={footer}>
      <Stack gap={3}>
        <Input {...field} label={t('console.feedback.resolution')} autoComplete="off" maxLength={500}
          error={form.formState.errors.resolution ? t('console.feedback.invalidResolution') : undefined} />
        {failure === null ? null : <ErrorMessage>{t(`console.feedback.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
