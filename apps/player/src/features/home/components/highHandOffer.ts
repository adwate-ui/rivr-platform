import type { HighHandLive } from '@rivr/db';
import { formatListedHand, formatNumber, t } from '@rivr/i18n';
import type { Offer } from '@rivr/ui';

/**
 * The high hand as an offer card (redesign RD-25), for Home's carousel: the promotion's name, and under it each hand with
 * its Bonus, `Royal flush 25,000 · Straight flush 10,000 · Four of a kind 5,000`.
 */
export function highHandOffer(live: HighHandLive): Offer {
  const hands = live.reward.hands.map((listed) => t('player.live.highHandEach', { hand: formatListedHand(listed.hand), chips: formatNumber(listed.chips) }));
  return { id: live.promotionId, title: t('player.live.highHandTitle'), offer: live.name, schedule: hands.join(' · ') };
}
