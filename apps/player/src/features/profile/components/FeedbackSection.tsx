import { zodResolver } from '@hookform/resolvers/zod';
import { FEEDBACK_TOPICS, quickFeedbackSchema } from '@rivr/contracts';
import { useFeedbackActions, type FeedbackFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Sheet, Stack, TextArea, useToast } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Send feedback (brief 3.9): a sheet with the topics as pills and what happened, then Send; sent, the sheet closes and a toast
 * says so. The topic is required, the note optional, as before.
 */
export function FeedbackSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { sendQuick } = useFeedbackActions();
  const toast = useToast();
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(quickFeedbackSchema));
  const form = useForm<z.input<typeof quickFeedbackSchema>, unknown, z.output<typeof quickFeedbackSchema>>({ resolver, defaultValues: { note: '' } });
  const submit = form.handleSubmit(async (answers) => {
    const sent = await sendQuick.mutateAsync(answers);
    setFailure(sent.ok ? null : sent.error);
    if (!sent.ok) return;
    form.reset({ note: '' });
    toast(t('player.profile.feedbackSent'));
    onClose();
  });
  const { errors } = form.formState;
  const noteField = form.register('note');
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('player.profile.sendFeedback')}>
      <Stack gap={4}>
        <Controller control={form.control} name="topic" render={({ field }) => (
          <ChoiceChips label={t('player.feedback.topic')} isLabelVisuallyHidden look="pill" mode="one" selected={field.value === undefined ? [] : [field.value]}
            options={FEEDBACK_TOPICS.map((topic) => ({ value: topic, label: t(`player.feedback.topics.${topic}`) }))} onChange={([topic]) => field.onChange(topic)} />
        )} />
        {errors.topic ? <ErrorMessage look="dot">{t('player.feedback.chooseTopic')}</ErrorMessage> : null}
        <TextArea {...noteField} label={t('player.profile.whatHappened')} rows={4} error={errors.note ? t('player.feedback.invalidNote') : undefined} />
        <Button variant="primary" size="tall" fullWidth isLoading={sendQuick.isPending} onClick={() => void submit()}>{t('player.profile.send')}</Button>
        {failure === null ? null : <ErrorMessage look="dot">{t(`player.feedback.failures.${failure}`)}</ErrorMessage>}
      </Stack>
    </Sheet>
  );
}
