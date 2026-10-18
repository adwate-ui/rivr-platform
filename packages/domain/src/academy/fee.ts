import { times, type Paise } from '../money/index.ts';

/** The fees in force, from the academy.price setting. */
export interface AcademyPrices {
  readonly individual: Paise;
  readonly corporatePerHead: Paise;
}

/**
 * What an Academy booking costs (scope-v1 module 15): one seat at the individual fee, or each head
 * of a company at the corporate fee. Nothing is rounded: these are not chips. The database's
 * private.academy_fee is proved equal by the same golden cases (packages/testing/golden/academy.json).
 */
export function academyFee(kind: 'individual' | 'corporate', seats: bigint, prices: AcademyPrices): Paise {
  if (seats < 1n || (kind === 'individual' && seats !== 1n)) {
    throw new RangeError('An individual booking is one seat; a corporate booking is one or more heads');
  }
  return kind === 'individual' ? prices.individual : times(prices.corporatePerHead, seats);
}
