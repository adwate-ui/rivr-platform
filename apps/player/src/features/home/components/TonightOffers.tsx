import { useFeature, useMyPromotionCards } from '@rivr/db';
import { useMyReferral } from '@rivr/db/myRewards';
import { formatChips, t } from '@rivr/i18n';
import { OfferCarousel, type Offer } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * Tonight's offers (brief 3.4 A3): the referral first (it left the tables for here), opening Rewards, then the club's live
 * promotions (#86, feature promotions.feed). Nothing while none is known: the tables matter more, and the next read
 * brings them. No table is picked out or featured.
 */
export function TonightOffers() {
  const navigate = useNavigate();
  const feed = useFeature('promotions.feed');
  const promotions = useMyPromotionCards().data ?? [];
  const bonus = useMyReferral().data?.bonus ?? null;
  const referral: Offer[] = bonus === null ? [] : [{
    id: 'referral', title: t('player.live.referralTitle'), offer: t('player.live.referralOffer', { chips: formatChips(bonus) }),
    schedule: t('player.live.referralSchedule'), onOpen: () => void navigate({ to: '/rewards' }),
  }];
  const live: Offer[] = feed.state === 'enabled'
    ? promotions.map((card) => ({ id: card.id, title: card.title, offer: card.detail ?? card.title, schedule: card.runs ?? undefined }))
    : [];
  const offers = [...referral, ...live];
  if (offers.length === 0) return null;
  return (
    <OfferCarousel title={t('player.live.title')} offers={offers}
      countLabel={offers.length === 1 ? t('player.live.offersOne') : t('player.live.offers', { count: offers.length })} />
  );
}
