import { useFeature, useMyHighHand, useMyPromotionCards, type HighHandLive } from '@rivr/db';
import { useMyReferral } from '@rivr/db/referral';
import type { Paise } from '@rivr/domain/money';
import { referralPromise } from '@rivr/domain/referral';
import { formatChips, t } from '@rivr/i18n';
import { OfferCarousel, type Offer } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { highHandOffer } from './highHandOffer.ts';

/**
 * A live offer on Home, by its kind. A new kind of card is one more member here, one more line where `useLiveOffers`
 * gathers them, and one more case in `cardOf`, which says how it is drawn.
 */
type LiveOffer =
  | { readonly kind: 'referral'; readonly bonus: Paise }
  | { readonly kind: 'promotion'; readonly id: string; readonly title: string; readonly detail: string | null; readonly runs: string | null; readonly link: string | null }
  | { readonly kind: 'highHand'; readonly live: HighHandLive; readonly link: string | null };

/**
 * Every offer live for the member now: Refer a friend first, only while a referral promotion is live (`referralPromise`
 * in @rivr/domain/referral; it opens Bonus), then the club's live promotions as the server orders them (#86, feature
 * promotions.feed; the promotion behind the referral is not listed again). The high hand that runs is among them in its
 * promotion's place, as its own kind, with its hands (redesign RD-25).
 */
function useLiveOffers(): LiveOffer[] {
  const feed = useFeature('promotions.feed');
  const promotions = useMyPromotionCards().data ?? [];
  const highHand = useMyHighHand().data ?? null;
  const referral = useMyReferral().data ?? null;
  const promise = referralPromise(referral?.bonus ?? null);
  const promotion = (card: (typeof promotions)[number]): LiveOffer => {
    const link = card.link ?? null;
    if (highHand !== null && card.id === highHand.promotionId) return { kind: 'highHand', live: highHand, link };
    return { kind: 'promotion', id: card.id, title: card.title, detail: card.detail, runs: card.runs, link };
  };
  return [
    ...(referral !== null && promise.kind === 'reward' ? [{ kind: 'referral', bonus: promise.bonus } as const] : []),
    ...(feed.state === 'enabled' ? promotions.map(promotion) : []),
  ];
}

/** How each kind of offer is drawn as a card: its eyebrow, its words, the line under them, and what a tap opens. */
function cardOf(offer: LiveOffer, openBonus: () => void): Offer {
  switch (offer.kind) {
    case 'referral':
      return {
        id: 'referral', title: t('player.live.referralTitle'), offer: t('player.live.referralOffer', { chips: formatChips(offer.bonus) }),
        schedule: t('player.live.referralLine'), onOpen: openBonus,
      };
    case 'promotion':
      return { id: offer.id, title: offer.title, offer: offer.detail ?? offer.title, schedule: offer.runs ?? undefined, href: offer.link ?? undefined };
    case 'highHand':
      return { ...highHandOffer(offer.live), href: offer.link ?? undefined };
  }
}

/**
 * Home's offers (redesign RD-20): one carousel through every live offer, a card each, with a dot for each. Nothing while
 * none is known: the tables matter more, and the next read brings them. No table is picked out or featured.
 */
export function TonightOffers() {
  const navigate = useNavigate();
  const offers = useLiveOffers();
  if (offers.length === 0) return null;
  const openBonus = () => void navigate({ to: '/bonus' });
  return <OfferCarousel title={t('player.live.offersTitle')} offers={offers.map((offer) => cardOf(offer, openBonus))} />;
}
