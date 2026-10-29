import { zodResolver } from '@hookform/resolvers/zod';
import { detailedFeedbackSchema, FEEDBACK_RATED, FEEDBACK_TOPICS, quickFeedbackSchema } from '@rivr/contracts';
import { useFeedbackActions, type FeedbackFailure } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Stack, StatusMessage, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

const FORMS = ['quick', 'detailed'] as const;
type FeedbackForm = (typeof FORMS)[number];
const SCORES = [1, 2, 3, 4, 5] as const;
const NPS = Array.from({ length: 11 }, (_, score) => score);

/** How a send went: nothing yet, sent, or why not. */
type Outcome = { ok: true } | { ok: false; error: FeedbackFailure } | null;

function OutcomeLine({ outcome }: { outcome: Outcome }) {
  return (
    <>
      {outcome !== null && !outcome.ok ? <ErrorMessage>{t(`player.feedback.failures.${outcome.error}`)}</ErrorMessage> : null}
      <StatusMessage>{outcome?.ok === true ? t('player.feedback.sent') : null}</StatusMessage>
    </>
  );
}

/** The quick form: one topic, and what the member says about it. */
function QuickForm() {
  const { sendQuick } = useFeedbackActions();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [resolver] = useState(() => zodResolver(quickFeedbackSchema));
  const form = useForm<z.input<typeof quickFeedbackSchema>, unknown, z.output<typeof quickFeedbackSchema>>({ resolver, defaultValues: { note: '' } });
  const submit = form.handleSubmit(async (answers) => {
    const sent = await sendQuick.mutateAsync(answers);
    setOutcome(sent.ok ? { ok: true } : { ok: false, error: sent.error });
    if (sent.ok) form.reset({ note: '' });
  });
  const errors = form.formState.errors;
  const noteField = form.register('note');
  return (
    <Stack gap={3}>
      <Controller control={form.control} name="topic" render={({ field }) => (
        <ChoiceChips label={t('player.feedback.topic')} mode="one" selected={field.value === undefined ? [] : [field.value]}
          options={FEEDBACK_TOPICS.map((topic) => ({ value: topic, label: t(`player.feedback.topics.${topic}`) }))}
          onChange={([topic]) => field.onChange(topic)} />
      )} />
      {errors.topic ? <ErrorMessage>{t('player.feedback.chooseTopic')}</ErrorMessage> : null}
      <TextArea {...noteField} label={t('player.feedback.noteLabel')} rows={3}
        error={errors.note ? t('player.feedback.invalidNote') : undefined} />
      <OutcomeLine outcome={outcome} />
      <Button variant="secondary" isLoading={sendQuick.isPending} onClick={() => void submit()}>{t('player.feedback.send')}</Button>
    </Stack>
  );
}

/** The detailed form: the gameplay, cashier, service and ambience each 1 to 5, the NPS question, and a note if they like. */
function DetailedForm() {
  const { sendDetailed } = useFeedbackActions();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [resolver] = useState(() => zodResolver(detailedFeedbackSchema));
  const form = useForm<z.input<typeof detailedFeedbackSchema>, unknown, z.output<typeof detailedFeedbackSchema>>({ resolver, defaultValues: { note: '' } });
  const submit = form.handleSubmit(async (answers) => {
    const sent = await sendDetailed.mutateAsync(answers);
    setOutcome(sent.ok ? { ok: true } : { ok: false, error: sent.error });
    if (sent.ok) form.reset({ note: '' });
  });
  const errors = form.formState.errors;
  const noteField = form.register('note');
  return (
    <Stack gap={3}>
      {FEEDBACK_RATED.map((area) => (
        <Controller key={area} control={form.control} name={`ratings.${area}`} render={({ field }) => (
          <ChoiceChips label={t(`player.feedback.rated.${area}`)} mode="one" selected={field.value === undefined ? [] : [String(field.value)]}
            options={SCORES.map((score) => ({ value: String(score), label: formatNumber(score) }))}
            onChange={([score]) => field.onChange(Number(score))} />
        )} />
      ))}
      {errors.ratings ? <ErrorMessage>{t('player.feedback.rateAll')}</ErrorMessage> : null}
      <Controller control={form.control} name="nps" render={({ field }) => (
        <ChoiceChips label={t('player.feedback.nps')} mode="one" selected={field.value === undefined ? [] : [String(field.value)]}
          options={NPS.map((score) => ({ value: String(score), label: formatNumber(score) }))}
          onChange={([score]) => field.onChange(Number(score))} />
      )} />
      {errors.nps ? <ErrorMessage>{t('player.feedback.chooseNps')}</ErrorMessage> : null}
      <TextArea {...noteField} label={t('player.feedback.openQuestion')} rows={3}
        error={errors.note ? t('player.feedback.invalidNote') : undefined} />
      <OutcomeLine outcome={outcome} />
      <Button variant="secondary" isLoading={sendDetailed.isPending} onClick={() => void submit()}>{t('player.feedback.send')}</Button>
    </Stack>
  );
}

/**
 * Feedback in Profile (#160, #637; decision 0165), where the Academy was: a quick note on one topic, or the detailed
 * form. The General Manager reads each as a ticket.
 */
export function FeedbackSection() {
  const [shown, setShown] = useState<FeedbackForm>('quick');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.feedback.title')}</Heading>
      <Text tone="muted">{t('player.feedback.intro')}</Text>
      <ChoiceChips label={t('player.feedback.form')} mode="one" selected={[shown]}
        options={FORMS.map((form) => ({ value: form, label: t(`player.feedback.forms.${form}`) }))}
        onChange={([form]) => { if (form !== undefined) setShown(form); }} />
      {shown === 'quick' ? <QuickForm /> : <DetailedForm />}
    </Stack>
  );
}
