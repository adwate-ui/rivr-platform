import { useTvPromotions } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Text, TvPromotionSlide } from '@rivr/ui';
import { useEffect, useState } from 'react';

// The prototype's TV turns to the next promotion every 12 seconds.
const SLIDE_MS = 12_000;

/** Which slide shows: the next every 12 seconds, round the live ones. */
function useRotation(count: number): number {
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (count < 2) return undefined;
    const timer = setInterval(() => setTurn((current) => current + 1), SLIDE_MS);
    return () => clearInterval(timer);
  }, [count]);
  return count === 0 ? 0 : turn % count;
}

/** The TV's Promotions mode (#86): the live promotions in rotation, one slide every 12 seconds, a quiet pager beneath. */
export function PromotionsMode({ venueId }: { venueId: string }) {
  const cards = useTvPromotions(venueId);
  const shown = useRotation(cards.data?.length ?? 0);
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
