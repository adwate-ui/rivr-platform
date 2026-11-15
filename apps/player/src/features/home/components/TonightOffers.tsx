import { useFeature, useMyPromotionCards } from '@rivr/db';
import { useMyReferral } from '@rivr/db/referral';
import { formatChips, t } from '@rivr/i18n';
import { OfferCarousel, type Offer } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useHighHandOffer } from './highHandOffer.ts';

type PromotionCard = NonNullable<ReturnType<typeof useMyPromotionCards>['data']>[number];

/**
 * The club's live promotions as offers, in their order: each by its card, and the high hand by its own, with its hands
 * (redesign RD-25), in its promotion's place and with that card's link.
 */
function liveOffers(cards: readonly PromotionCard[], highHand: Offer | null): Offer[] {
  return cards.map((card) => {
    const href = card.link ?? undefined;
    if (card.id === highHand?.id) return { ...highHand, href };
    return { id: card.id, title: card.title, offer: card.detail ?? card.title, schedule: card.runs ?? undefined, href };
  });
}

/**
 * Tonight's offers (brief 3.4 A3): the referral first (it left the tables for here), opening Bonus, then the club's live
 * promotions (#86, feature promotions.feed), the high hand among them with its hands. Nothing while none is known: the
 * tables matter more, and the next read brings them. No table is picked out or featured.
 */
export function TonightOffers() {
  const navigate = useNavigate();
  const feed = useFeature('promotions.feed');
  const promotions = useMyPromotionCards().data ?? [];
  const highHand = useHighHandOffer();
  const bonus = useMyReferral().data?.bonus ?? null;
  const referral: Offer[] = bonus === null ? [] : [{
    id: 'referral', title: t('player.live.referralTitle'), offer: t('player.live.referralOffer', { chips: formatChips(bonus) }),
    onOpen: () => void navigate({ to: '/bonus' }),
  }];
  const live = feed.state === 'enabled' ? liveOffers(promotions, highHand) : [];
  const offers = [...referral, ...live];
  if (offers.length === 0) return null;
  return (
    <OfferCarousel title={t('player.live.offersTitle')} offers={offers}
      countLabel={offers.length === 1 ? t('player.live.offersOne') : t('player.live.offers', { count: offers.length })} />
  );
}
