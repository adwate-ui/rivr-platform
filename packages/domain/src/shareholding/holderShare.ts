import { isNegative, negate, shareOf, type Paise } from '../money/index.ts';

/**
 * A partner's or investor's share of a club month's net result (#98; decision 0189): the net times their
 * holding in basis points on the month's last day (decision 0170), rounded towards nothing to the paisa,
 * so a loss is shared as a profit is and never more than its share. A holding outside 0% to 100% is a bug
 * in the caller and throws, as shareOf does.
 */
export function holderShare(net: Paise, basisPoints: bigint): Paise {
  return isNegative(net) ? negate(shareOf(negate(net), basisPoints)) : shareOf(net, basisPoints);
}
