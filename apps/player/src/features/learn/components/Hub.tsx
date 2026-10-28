import { isDue, masteryOf, summarise, type AttemptRow, type CardState } from '@rivr/drills';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, Grid, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import type { Book } from '../drill.ts';

const LENGTHS = ['10', '20', '50'] as const;

/** One figure on the hub: its name over its value. */
function Tile({ name, value }: { name: string; value: string }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{name}</Text>
      <Text weight="semibold">{value}</Text>
    </Stack>
  );
}

interface HubProps {
  book: Book;
  cards: ReadonlyMap<string, CardState>;
  rows: readonly AttemptRow[];
  onStart: (length: number) => void;
  onReview: () => void;
}

/** A title's hub (#133): due now, mastery across the book, answers and accuracy; then a drill of 10, 20 or 50 spots, or the review. */
export function Hub({ book, cards, rows, onStart, onReview }: HubProps) {
  const [length, setLength] = useState<(typeof LENGTHS)[number]>('10');
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
        <Tile name={t('player.learn.hub.mastery')} value={t('player.learn.hub.masteryValue', { met: mastery.met, total: mastery.total })} />
        <Tile name={t('player.learn.hub.answered')} value={formatNumber(summary.attempts)} />
        <Tile name={t('player.learn.hub.accuracy')} value={summary.attempts === 0 ? t('player.learn.hub.noAccuracy')
          : t('player.learn.summary.accuracyValue', { percent: Math.round(summary.rate * 100) })} />
      </Grid>
      <ChoiceChips label={t('player.learn.hub.length')} mode="one" selected={[length]}
        options={LENGTHS.map((value) => ({ value, label: value }))} onChange={(chosen) => { if (chosen[0] !== undefined) setLength(chosen[0]); }} />
      <Inline gap={3} wrap>
        <Button variant="primary" onClick={() => onStart(Number(length))}>{t('player.learn.hub.start')}</Button>
        <Button variant="secondary" onClick={onReview}>{t('player.learn.hub.review')}</Button>
      </Inline>
    </Stack>
  );
}
