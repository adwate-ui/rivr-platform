import { zodResolver } from '@hookform/resolvers/zod';
import { feedbackResolveSchema } from '@rivr/contracts';
import { useResolveFeedback, type ResolveFeedbackFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack, useToast } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/** One line of what was done, for every ticket ticked (F-013); the lists then show them resolved, with the staff member's name. */
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
  return (
    <Stack gap={2}>
      {/* Resolve beside the console's filled field, level at their foot (console v3); what is wrong goes under the row, so they stay level. */}
      <Inline gap={2} align="end">
        <Input {...field} variant="subtle" label={t('console.feedback.resolution')} autoComplete="off" maxLength={500} />
        <Button variant="subtle" size="compact" isLoading={resolve.isPending} onClick={() => void submit()}>{t('console.feedback.resolveCount', { count: ids.length })}</Button>
        <Button variant="text" size="compact" onClick={onCancel}>{t('console.feedback.cancel')}</Button>
      </Inline>
      {form.formState.errors.resolution ? <ErrorMessage>{t('console.feedback.invalidResolution')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(`console.feedback.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
