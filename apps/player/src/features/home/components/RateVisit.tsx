import { visitRatingSchema } from '@rivr/contracts';
import { useFeedbackActions, useMyFeedbackVisit, type FeedbackFailure, type FeedbackVisit } from '@rivr/db';
import { formatHoursMinutes, t } from '@rivr/i18n';
import { Box, Button, ChoiceChips, ErrorMessage, Heading, Inline, Stack, Text, TextArea, useToast } from '@rivr/ui';
import { useState } from 'react';

const SCORES = ['1', '2', '3', '4', '5'] as const;

/** The note and Send, once a score is picked; sent, a toast, and the card goes as the visit is rated. */
function SendRating({ visit, score }: { visit: FeedbackVisit; score: number }) {
  const { rate } = useFeedbackActions();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [failure, setFailure] = useState<FeedbackFailure | null>(null);
  const send = async () => {
    const checked = visitRatingSchema.safeParse({ score, note });
    if (!checked.success) {
      setFailure('invalid');
      return;
    }
    const outcome = await rate.mutateAsync({ visitId: visit.visitId, score: checked.data.score, note: checked.data.note });
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) toast(t('player.live.rate.sentToast'));
  };
  return (
    <Stack gap={3}>
      <TextArea label={t('player.live.rate.note')} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      <Button variant="primary" size="large" fullWidth isLoading={rate.isPending} onClick={() => void send()}>{t('player.live.rate.send')}</Button>
      {failure === null ? null : <ErrorMessage look="dot">{t(`player.feedback.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/**
 * Rate your visit (brief 3.4 F; #160, decision 0165), on Tonight after a visit while the member browses: the night's time
 * and table, "How was your night?", five numbers from Poor to Excellent, then a note if they like and Send to the General
 * Manager. Nothing when there is no visit to rate.
 */
export function RateVisit() {
  const visit = useMyFeedbackVisit().data ?? null;
  const [score, setScore] = useState<number | null>(null);
  if (visit === null) return null;
  return (
    <Box paddingX={5} paddingY={5}>
      <Stack gap={4}>
        <Text variant="eyebrow" tone="accent">
          {t('player.live.rate.eyebrow', { duration: formatHoursMinutes(visit.playedSeconds), table: visit.tableName ?? '' })}
        </Text>
        <Heading level={2} variant="serif">{t('player.live.rate.title')}</Heading>
        <Stack gap={2}>
          <ChoiceChips label={t('player.feedback.score')} isLabelVisuallyHidden look="tile" mode="one"
            selected={score === null ? [] : [String(score)]} options={SCORES.map((value) => ({ value, label: value }))}
            onChange={([value]) => setScore(value === undefined ? null : Number(value))} />
          <Inline justify="between">
            <Text variant="caption" tone="muted">{t('player.live.rate.poor')}</Text>
            <Text variant="caption" tone="muted">{t('player.live.rate.excellent')}</Text>
          </Inline>
        </Stack>
        {score === null ? null : <SendRating visit={visit} score={score} />}
      </Stack>
    </Box>
  );
}
