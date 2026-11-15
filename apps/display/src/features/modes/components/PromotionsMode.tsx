import { useTvPromotions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Text, TvPromotionSlide, TvStage } from '@rivr/ui';
import { useEffect, useState } from 'react';
import { BoardStatus } from './BoardStatus.tsx';

// The prototype's TV turns to the next promotion every 12 seconds; the board's progress bar fills over each (#628).
export const SLIDE_MS = 12_000;

/**
 * Which slide shows: the next every `slideMs`, 12 seconds unless Settings says otherwise, round the live ones. In a TV's
 * rotation (decision 0163) each shows once, then `onDone`; at once when none is live. `count` is undefined until read.
 */
export function useSlides(count: number | undefined, onDone: (() => void) | undefined, slideMs: number = SLIDE_MS): number {
  const [turn, setTurn] = useState(0);
  const isRotating = onDone !== undefined;
  useEffect(() => {
    if (count === undefined || count === 0 || (count < 2 && !isRotating)) return undefined;
    const timer = setInterval(() => setTurn((current) => current + 1), slideMs);
    return () => clearInterval(timer);
  }, [count, isRotating, slideMs]);
  useEffect(() => {
    if (onDone === undefined || count === undefined) return undefined;
    // None live: the board says so for a slide's time, then passes on, so a rotation of empty boards rests on it (D-03).
    if (count === 0) {
      const timer = setTimeout(onDone, slideMs);
      return () => clearTimeout(timer);
    }
    if (turn >= count) onDone();
    return undefined;
  }, [onDone, count, turn, slideMs]);
  return count === undefined || count === 0 ? 0 : turn % count;
}

/**
 * The TV's Promotions mode (#86): the live promotions in rotation, one slide every `slideMs` (the seconds Settings gives
 * the board, 12 unless set), a quiet pager beneath. In a TV's rotation, `onDone` once each has shown, or when none can be shown.
 */
export function PromotionsMode({ onDone, slideMs = SLIDE_MS }: { onDone?: (() => void) | undefined; slideMs?: number | undefined }) {
  const cards = useTvPromotions();
  const shown = useSlides(cards.data?.length ?? (cards.isError ? 0 : undefined), onDone, slideMs);
  if (cards.data === undefined) {
    return <BoardStatus isError={cards.isError} />;
  }
  const card = cards.data[shown];
  if (card === undefined) {
    return <TvStage title={t('tv.promotion.title')}><Text variant="tvBody" tone="muted">{t('tv.promotion.none')}</Text></TvStage>;
  }
  const position = { current: shown + 1, count: cards.data.length };
  return (
    <TvPromotionSlide board={t('tv.promotion.title')} label={t('tv.promotion.label')} title={card.title} detail={card.detail ?? undefined}
      when={card.runs ?? undefined} pager={{ ...position, label: t('tv.promotion.pager', position) }} />
  );
}
