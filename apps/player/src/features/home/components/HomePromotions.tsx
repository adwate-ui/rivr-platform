import { useFeature, useMyPromotionCards } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, PromotionPager } from '@rivr/ui';

/**
 * The live promotions on Home (#86): one card at a time with a quiet pager, with feature
 * promotions.feed. Nothing shows while they load, when none is live, or if they cannot be read: Home's
 * floor matters more, and the cards come back on the next read.
 */
export function HomePromotions() {
  const feed = useFeature('promotions.feed');
  const cards = useMyPromotionCards();
  const live = cards.data ?? [];
  return (
    <FeatureGate access={feed}>
      <PromotionPager label={t('player.promotions.label')}
        cards={live.map((card) => ({ id: card.id, title: card.title, detail: card.detail ?? undefined, runs: card.runs ?? undefined }))}
        pageLabels={live.map((_, index) => t('player.promotions.page', { current: index + 1, count: live.length }))} />
    </FeatureGate>
  );
}
