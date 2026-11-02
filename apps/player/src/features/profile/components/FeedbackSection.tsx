import { zodResolver } from '@hookform/resolvers/zod';
import { detailedFeedbackSchema, FEEDBACK_RATED, FEEDBACK_TOPICS, quickFeedbackSchema } from '@rivr/contracts';
import { useFeedbackActions, type FeedbackFailure } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Sheet, Stack, TextArea, useToast } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

const FORMS = ['quick', 'detailed'] as const;
type FeedbackForm = (typeof FORMS)[number];
const SCORES = [1, 2, 3, 4, 5] as const;
const NPS = Array.from({ length: 11 }, (_, score) => score);

/** Send, busy while it goes, and why it did not go through under it. */
function SendLine({ isPending, failure, onSend }: { isPending: boolean; failure: FeedbackFailure | null; onSend: () => void }) {
  return (
    <>
      <Button variant="primary" size="tall" fullWidth isLoading={isPending} onClick={onSend}>{t('player.profile.send')}</Button>
      {failure === null ? null : <ErrorMessage look="dot">{t(`player.feedback.failures.${failure}`)}</ErrorMessage>}
    </>
  );
}

/** The prototype's form: the topics as pills (one, required) and what happened (optional). */
function QuickForm({ onSent }: { onSent: () => void }) {
  const { sendQuick } = useFeedbackActions();
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(quickFeedbackSchema));
  const form = useForm<z.input<typeof quickFeedbackSchema>, unknown, z.output<typeof quickFeedbackSchema>>({ resolver, defaultValues: { note: '' } });
  const submit = form.handleSubmit(async (answers) => {
    const sent = await sendQuick.mutateAsync(answers);
    setFailure(sent.ok ? null : sent.error);
    if (sent.ok) onSent();
  });
  const { errors } = form.formState;
  const noteField = form.register('note');
  return (
    <Stack gap={4}>
      <Controller control={form.control} name="topic" render={({ field }) => (
        <ChoiceChips label={t('player.feedback.topic')} isLabelVisuallyHidden look="pill" mode="one" selected={field.value === undefined ? [] : [field.value]}
          options={FEEDBACK_TOPICS.map((topic) => ({ value: topic, label: t(`player.feedback.topics.${topic}`) }))} onChange={([topic]) => field.onChange(topic)} />
      )} />
      {errors.topic ? <ErrorMessage look="dot">{t('player.feedback.chooseTopic')}</ErrorMessage> : null}
      <TextArea {...noteField} label={t('player.profile.whatHappened')} rows={4} error={errors.note ? t('player.feedback.invalidNote') : undefined} />
      <SendLine isPending={sendQuick.isPending} failure={failure} onSend={() => void submit()} />
    </Stack>
  );
}

/** The detailed form (#637), kept from before the redesign: four areas 1 to 5, the 0 to 10 question, and a note if they like. */
function DetailedForm({ onSent }: { onSent: () => void }) {
  const { sendDetailed } = useFeedbackActions();
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(detailedFeedbackSchema));
  const form = useForm<z.input<typeof detailedFeedbackSchema>, unknown, z.output<typeof detailedFeedbackSchema>>({ resolver, defaultValues: { note: '' } });
  const submit = form.handleSubmit(async (answers) => {
    const sent = await sendDetailed.mutateAsync(answers);
    setFailure(sent.ok ? null : sent.error);
    if (sent.ok) onSent();
  });
  const { errors } = form.formState;
  const noteField = form.register('note');
  return (
    <Stack gap={4}>
      {FEEDBACK_RATED.map((area) => (
        <Controller key={area} control={form.control} name={`ratings.${area}`} render={({ field }) => (
          <ChoiceChips label={t(`player.feedback.rated.${area}`)} look="pill" mode="one" selected={field.value === undefined ? [] : [String(field.value)]}
            options={SCORES.map((score) => ({ value: String(score), label: formatNumber(score) }))} onChange={([score]) => field.onChange(Number(score))} />
        )} />
      ))}
      {errors.ratings ? <ErrorMessage look="dot">{t('player.feedback.rateAll')}</ErrorMessage> : null}
      <Controller control={form.control} name="nps" render={({ field }) => (
        <ChoiceChips label={t('player.feedback.nps')} look="pill" mode="one" selected={field.value === undefined ? [] : [String(field.value)]}
          options={NPS.map((score) => ({ value: String(score), label: formatNumber(score) }))} onChange={([score]) => field.onChange(Number(score))} />
      )} />
      {errors.nps ? <ErrorMessage look="dot">{t('player.feedback.chooseNps')}</ErrorMessage> : null}
      <TextArea {...noteField} label={t('player.feedback.openQuestion')} rows={3} error={errors.note ? t('player.feedback.invalidNote') : undefined} />
      <SendLine isPending={sendDetailed.isPending} failure={failure} onSend={() => void submit()} />
    </Stack>
  );
}

/**
 * Send feedback (brief 3.9): a sheet, with the prototype's quick note (topic pills and what happened) first and the
 * detailed form (#637) a tab away, as Profile had both before the redesign. Sent, the sheet closes and a toast says so.
 */
export function FeedbackSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const toast = useToast();
  const [shown, setShown] = useState<FeedbackForm>('quick');
  const sent = () => {
    toast(t('player.profile.feedbackSent'));
    onClose();
  };
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={t('player.profile.sendFeedback')}>
      <Stack gap={4}>
        <ChoiceChips label={t('player.feedback.form')} isLabelVisuallyHidden look="tabs" mode="one" selected={[shown]}
          options={FORMS.map((form) => ({ value: form, label: t(`player.feedback.forms.${form}`) }))}
          onChange={([form]) => { if (form !== undefined) setShown(form); }} />
        {shown === 'quick' ? <QuickForm onSent={sent} /> : <DetailedForm onSent={sent} />}
      </Stack>
    </Sheet>
  );
}
