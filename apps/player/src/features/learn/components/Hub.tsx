import { isDue, masteryOf, summarise, type AttemptRow, type CardState } from '@rivr/drills';
import { formatNumber, t } from '@rivr/i18n';
import { useFeature } from '@rivr/db';
import { Button, ChoiceChips, FeatureGate, Grid, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import type { Book } from '../drill.ts';

const LENGTHS = ['10', '20', '50'] as const;

/** One figure on the hub: its name over its value, and what the value is of. */
function Tile({ name, value, detail }: { name: string; value: string; detail?: string }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{name}</Text>
      <Text weight="semibold">{value}</Text>
      {detail === undefined ? null : <Text variant="small" tone="muted">{detail}</Text>}
    </Stack>
  );
}

interface HubProps {
  book: Book;
  cards: ReadonlyMap<string, CardState>;
  rows: readonly AttemptRow[];
  /** Answers in this title in all. */
  answered: number;
  onStart: (length: number) => void;
  onReview: () => void;
  onLessons: () => void;
}

/** A title's hub (#133): due now, mastery across the book, answers and accuracy; then a drill of 10, 20 or 50 spots, the review, or the lessons (#134). */
export function Hub({ book, cards, rows, answered, onStart, onReview, onLessons }: HubProps) {
  const [length, setLength] = useState<(typeof LENGTHS)[number]>('10');
  const review = useFeature('learn.review');
  const lessons = useFeature('learn.academy_lessons');
  const [now] = useState(() => Date.now());
  const due = book.principles.filter((principle) => {
    const card = cards.get(principle.id);
    return card === undefined || isDue(card, now);
  }).length;
  const mastery = masteryOf(book.principles, cards, now);
  const summary = summarise(rows);
  return (
    <Stack gap={6}>
      <Grid columns={2}>
        <Tile name={t('player.learn.hub.due')} value={formatNumber(due)} />
        <Tile name={t('player.learn.hub.mastery')} value={t('player.learn.summary.accuracyValue', { percent: Math.round(mastery.score * 100) })}
          detail={t('player.learn.hub.masteryValue', { met: mastery.met, total: mastery.total })} />
        <Tile name={t('player.learn.hub.answered')} value={formatNumber(answered)} />
        <Tile name={t('player.learn.hub.accuracy')} value={summary.attempts === 0 ? t('player.learn.hub.noAccuracy')
          : t('player.learn.summary.accuracyValue', { percent: Math.round(summary.rate * 100) })} />
      </Grid>
      <ChoiceChips label={t('player.learn.hub.length')} mode="one" selected={[length]}
        options={LENGTHS.map((value) => ({ value, label: value }))} onChange={(chosen) => { if (chosen[0] !== undefined) setLength(chosen[0]); }} />
      <Inline gap={3} wrap>
        <Button variant="primary" onClick={() => onStart(Number(length))}>{t('player.learn.hub.start')}</Button>
        <FeatureGate access={review}><Button variant="secondary" onClick={onReview}>{t('player.learn.hub.review')}</Button></FeatureGate>
        <FeatureGate access={lessons}><Button variant="secondary" onClick={onLessons}>{t('player.learn.lessons.open')}</Button></FeatureGate>
      </Inline>
    </Stack>
  );
}
