import { useFeature } from '@rivr/db';
import { useCompleteLearnSession, useLearnProgressQueue } from '@rivr/db/learn';
import { formatNumber, t } from '@rivr/i18n';
import { Button, FeatureGate, Grid, Heading, Inline, Stack, StatusMessage, Text } from '@rivr/ui';
import { useEffect, useRef, useState } from 'react';
import type { Book, Marked } from '../drill.ts';

const MOST_MISSED = 3;

interface SummaryViewProps {
  book: Book;
  sessionId: string;
  sourceKey: string;
  results: readonly Marked[];
  onAgain: () => void;
  onReview: () => void;
  onHub: () => void;
}

/** The principles missed most this session, by name. */
function mostMissed(book: Book, results: readonly Marked[]): string[] {
  const misses = new Map<string, number>();
  for (const result of results) if (!result.grade.correct) misses.set(result.attempt.principleId, (misses.get(result.attempt.principleId) ?? 0) + 1);
  return [...misses.entries()].sort((a, b) => b[1] - a[1]).slice(0, MOST_MISSED)
    .map(([id]) => book.principles.find((principle) => principle.id === id)?.name ?? id);
}

/**
 * Completes the session once its answers are sent (#135): the points it earned. Offline, the completion waits in the
 * queue with the answers and the points arrive later.
 */
function useSessionPoints(sessionId: string, principles: readonly string[]): number | 'pending' | null {
  const queue = useLearnProgressQueue();
  const complete = useCompleteLearnSession();
  const [points, setPoints] = useState<number | 'pending' | null>(null);
  // Once, when the summary opens.
  const isStarted = useRef(false);
  useEffect(() => {
    if (isStarted.current) return;
    isStarted.current = true;
    const later = () => {
      void queue.enqueue({ answers: [], cards: [], completed: { sessionId, principles } }, `${sessionId}:completed`);
      setPoints('pending');
    };
    void queue.flush().then(async (flushed) => {
      // Only once every answer is on the server, or the session would close on part of them.
      if (flushed.pending > 0) { later(); return; }
      const done = await complete.mutateAsync({ sessionId, principles });
      if (done.ok) setPoints(done.value);
      else later();
    }).catch(later);
  }, [queue, complete, sessionId, principles]);
  return points;
}

/** The summary (#136, flow 11): answered, correct and accuracy, the principles most missed, and the points earned. */
export function SummaryView({ book, sessionId, results, onAgain, onReview, onHub }: SummaryViewProps) {
  const correct = results.filter((result) => result.grade.correct);
  const points = useSessionPoints(sessionId, [...new Set(correct.map((result) => result.attempt.principleId))]);
  const missed = mostMissed(book, results);
  const review = useFeature('learn.review');
  return (
    <Stack gap={6}>
      <Heading level={2}>{t('player.learn.summary.title')}</Heading>
      <Grid columns={3}>
        <Stack gap={1}><Text variant="small" tone="muted">{t('player.learn.summary.answered')}</Text><Text weight="semibold">{formatNumber(results.length)}</Text></Stack>
        <Stack gap={1}><Text variant="small" tone="muted">{t('player.learn.summary.correct')}</Text><Text weight="semibold">{formatNumber(correct.length)}</Text></Stack>
        <Stack gap={1}><Text variant="small" tone="muted">{t('player.learn.summary.accuracy')}</Text>
          <Text weight="semibold">{t('player.learn.summary.accuracyValue', { percent: Math.round((correct.length * 100) / Math.max(1, results.length)) })}</Text></Stack>
      </Grid>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{t('player.learn.summary.missed')}</Text>
        {missed.length === 0 ? <Text>{t('player.learn.summary.noneMissed')}</Text> : missed.map((name) => <Text key={name}>{name}</Text>)}
      </Stack>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{t('player.learn.summary.points')}</Text>
        <StatusMessage>{points === null ? null : points === 'pending' ? t('player.learn.summary.pointsPending') : formatNumber(points)}</StatusMessage>
      </Stack>
      <Inline gap={3} wrap>
        <Button variant="primary" onClick={onAgain}>{t('player.learn.summary.again')}</Button>
        <FeatureGate access={review}><Button variant="secondary" onClick={onReview}>{t('player.learn.summary.review')}</Button></FeatureGate>
        <Button variant="text" onClick={onHub}>{t('player.learn.summary.hub')}</Button>
      </Inline>
    </Stack>
  );
}
