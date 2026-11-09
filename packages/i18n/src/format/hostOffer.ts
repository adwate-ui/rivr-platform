import { t } from '../translate.ts';
import { formatChips, formatNumber } from './money.ts';

/** The parts of a promotion effect that a host's offer names. */
export interface HostOfferWords {
  readonly kind: string;
  readonly points?: number;
  readonly amount_paise?: number;
}

/** A host's offer in words, for the queue, the Door and the record: `500 points`, `2,000 bonus chips` (#629), never rupees. */
export function formatHostOffer(offer: HostOfferWords): string {
  if (offer.kind === 'points' && offer.points !== undefined) return t('console.hostQueue.offer.points', { points: formatNumber(offer.points) });
  if (offer.kind === 'bonus' && offer.amount_paise !== undefined) return t('console.hostQueue.offer.bonus', { chips: formatChips(BigInt(offer.amount_paise)) });
  if (offer.kind === 'spin') return t('console.hostQueue.offer.spin');
  if (offer.kind === 'message') return t('console.hostQueue.offer.message');
  return t('console.hostQueue.offer.other');
}
