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
      <Inline gap={3} align="end">
        <Input {...field} label={t('console.feedback.resolution')} hint={t('console.feedback.resolutionHint')} autoComplete="off"
          error={form.formState.errors.resolution ? t('console.feedback.invalidResolution') : undefined} />
        <Button variant="secondary" isLoading={resolve.isPending} aria-label={t('console.feedback.resolveName', { name: item.fullName })}
          onClick={() => void submit()}>
          {t('console.feedback.resolve')}
        </Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`console.feedback.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
