import { zodResolver } from '@hookform/resolvers/zod';
import { feedbackResolveSchema } from '@rivr/contracts';
import { useResolveFeedback, type FeedbackFailure, type FeedbackItem } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Input, Stack } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/** Resolves an open ticket with what was done; the list then shows it resolved, with the staff member's name. */
export function ResolveForm({ venueId, item }: { venueId: string; item: FeedbackItem }) {
  const resolve = useResolveFeedback(venueId);
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(feedbackResolveSchema));
  const form = useForm<z.input<typeof feedbackResolveSchema>, unknown, z.output<typeof feedbackResolveSchema>>({
    resolver, defaultValues: { resolution: '' },
  });
  const submit = form.handleSubmit(async ({ resolution }) => {
    const outcome = await resolve.mutateAsync({ feedbackId: item.id, resolution });
    setFailure(outcome.ok ? null : outcome.error);
  });
  const field = form.register('resolution');
  return (
    <Stack gap={2}>
      {/* Resolve beside the console's filled field, level at their foot (console v3); what is wrong goes under the row, so they stay level. */}
      <Inline gap={2} align="end">
        <Input {...field} variant="subtle" label={t('console.feedback.resolution')} autoComplete="off" maxLength={500} />
        <Button variant="subtle" size="compact" isLoading={resolve.isPending} aria-label={t('console.feedback.resolveName', { name: item.fullName })}
          onClick={() => void submit()}>
          {t('console.feedback.resolve')}
        </Button>
      </Inline>
      {form.formState.errors.resolution ? <ErrorMessage>{t('console.feedback.invalidResolution')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(`console.feedback.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
