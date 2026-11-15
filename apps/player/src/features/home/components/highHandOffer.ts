import { useMyHighHand, type HighHandLive } from '@rivr/db';
import { formatListedHand, formatNumber, t } from '@rivr/i18n';
import type { Offer } from '@rivr/ui';

/**
 * The high hand as an offer card (redesign RD-25): the promotion's name, and under it each hand with its Bonus, `Royal
 * flush 25,000 · Straight flush 10,000 · Four of a kind 5,000`.
 */
export function highHandOffer(live: HighHandLive): Offer {
  const hands = live.reward.hands.map((listed) => t('player.live.highHandEach', { hand: formatListedHand(listed.hand), chips: formatNumber(listed.chips) }));
  return { id: live.promotionId, title: t('player.live.highHandTitle'), offer: live.name, schedule: hands.join(' · ') };
}

/** The high hand among the member's offers, as its card; null while none runs for them. */
export function useHighHandOffer(): Offer | null {
  const live = useMyHighHand().data ?? null;
  return live === null ? null : highHandOffer(live);
}
