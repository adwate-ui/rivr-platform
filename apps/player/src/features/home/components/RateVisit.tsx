import { zodResolver } from '@hookform/resolvers/zod';
import { visitRatingSchema } from '@rivr/contracts';
import { useFeedbackActions, useMyFeedbackVisit, type FeedbackFailure } from '@rivr/db';
import { formatWeekday, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Heading, Stack, Text, TextArea } from '@rivr/ui';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

const SCORES = ['1', '2', '3', '4', '5'] as const;

/**
 * On Home after a visit (#160, decision 0165): how was it? A rating of 1 to 5 and a note if the member
 * likes, once a visit, in the week after it. Sent, it thanks them; a 3 or below says the General
 * Manager will look into it. Nothing when there is no visit to rate.
 */
export function RateVisit() {
  const visit = useMyFeedbackVisit();
  const { rate } = useFeedbackActions();
  const [sentScore, setSentScore] = useState<number | null>(null);
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const [resolver] = useState(() => zodResolver(visitRatingSchema));
  const form = useForm<z.input<typeof visitRatingSchema>, unknown, z.output<typeof visitRatingSchema>>({ resolver, defaultValues: { note: '' } });
  if (sentScore !== null) return <Text>{t(sentScore <= 3 ? 'player.feedback.thanksFollowUp' : 'player.feedback.thanks')}</Text>;
  const rated = visit.data;
  if (!rated) return null;
  const submit = form.handleSubmit(async ({ score, note }) => {
    const outcome = await rate.mutateAsync({ visitId: rated.visitId, score, note });
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) setSentScore(score);
  });
  const noteField = form.register('note');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.feedback.prompt', { day: formatWeekday(new Date(rated.closedAt)) })}</Heading>
      <Text tone="muted">{t('player.feedback.promptHint')}</Text>
      <Controller control={form.control} name="score" render={({ field }) => (
        <ChoiceChips label={t('player.feedback.score')} mode="one" isDisabled={rate.isPending} selected={field.value === undefined ? [] : [String(field.value)]}
          options={SCORES.map((score) => ({ value: score, label: score }))} onChange={([score]) => field.onChange(score === undefined ? undefined : Number(score))} />
      )} />
      <TextArea {...noteField} label={t('player.feedback.note')} rows={2} />
      {form.formState.errors.score || form.formState.errors.note ? <ErrorMessage>{t('player.feedback.failures.invalid')}</ErrorMessage> : null}
      {failure === null ? null : <ErrorMessage>{t(`player.feedback.failures.${failure}`)}</ErrorMessage>}
      <Button isLoading={rate.isPending} onClick={() => void submit()}>{t('player.feedback.send')}</Button>
    </Stack>
  );
}
