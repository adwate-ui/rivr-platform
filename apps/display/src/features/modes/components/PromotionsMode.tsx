import { useTvPromotions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Text, TvPromotionSlide } from '@rivr/ui';
import { useEffect, useState } from 'react';

// The prototype's TV turns to the next promotion every 12 seconds; the board's progress bar fills over each (#628).
export const SLIDE_MS = 12_000;

/**
 * Which slide shows: the next every 12 seconds, round the live ones. In a TV's rotation (decision
 * 0163) each shows once, then `onDone`; at once when none is live. `count` is undefined until read.
 */
export function useSlides(count: number | undefined, onDone: (() => void) | undefined): number {
  const [turn, setTurn] = useState(0);
  const isRotating = onDone !== undefined;
  useEffect(() => {
    if (count === undefined || count === 0 || (count < 2 && !isRotating)) return undefined;
    const timer = setInterval(() => setTurn((current) => current + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [count, isRotating]);
  useEffect(() => {
    if (onDone !== undefined && count !== undefined && turn >= count) onDone();
  }, [onDone, count, turn]);
  return count === undefined || count === 0 ? 0 : turn % count;
}

/**
 * The TV's Promotions mode (#86): the live promotions in rotation, one slide every 12 seconds, a quiet
 * pager beneath. In a TV's rotation, `onDone` once each has shown, or when none can be shown.
 */
export function PromotionsMode({ onDone }: { onDone?: (() => void) | undefined }) {
  const cards = useTvPromotions();
  const shown = useSlides(cards.data?.length ?? (cards.isError ? 0 : undefined), onDone);
  if (cards.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(cards.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  const card = cards.data[shown];
  if (card === undefined) return <Text variant="tvBody" tone="muted">{t('tv.promotion.none')}</Text>;
  const position = { current: shown + 1, count: cards.data.length };
  return (
    <TvPromotionSlide label={t('tv.promotion.label')} title={card.title} detail={card.detail ?? undefined} when={card.runs ?? undefined}
      pager={{ ...position, label: t('tv.promotion.pager', position) }} />
  );
}
