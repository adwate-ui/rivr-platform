import { zodResolver } from '@hookform/resolvers/zod';
import { feedbackNoteSchema } from '@rivr/contracts';
import { useFeedbackActions, type FeedbackFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Stack, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

/** Feedback in Profile (#160, decision 0165): a note to the club at any time, which the General Manager reads as a ticket. */
export function FeedbackSection() {
  const { send } = useFeedbackActions();
  const [isSent, setIsSent] = useState(false);
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(feedbackNoteSchema));
  const form = useForm<z.input<typeof feedbackNoteSchema>, unknown, z.output<typeof feedbackNoteSchema>>({ resolver, defaultValues: { note: '' } });
  const submit = form.handleSubmit(async ({ note }) => {
    const outcome = await send.mutateAsync(note);
    setFailure(outcome.ok ? null : outcome.error);
    setIsSent(outcome.ok);
    if (outcome.ok) form.reset();
  });
  const noteField = form.register('note');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.feedback.title')}</Heading>
      <Text tone="muted">{t('player.feedback.intro')}</Text>
      <TextArea {...noteField} label={t('player.feedback.noteLabel')} rows={3}
        error={form.formState.errors.note ? t('player.feedback.invalidNote') : undefined} />
      {failure === null ? null : <ErrorMessage>{t(`player.feedback.failures.${failure}`)}</ErrorMessage>}
      {isSent ? <Text>{t('player.feedback.sent')}</Text> : null}
      <Button variant="secondary" isLoading={send.isPending} onClick={() => void submit()}>{t('player.feedback.send')}</Button>
    </Stack>
  );
}
