import { formatNumber } from './money.ts';

/**
 * A tournament level's blinds in chips, as the clock shows them (#119): `400/800`, and with an ante above
 * nothing `400/800 ante 800`. Chips, not money: Indian grouping, no rupee sign.
 */
export function formatBlinds(smallBlind: number, bigBlind: number, ante = 0): string {
  const blinds = `${formatNumber(smallBlind)}/${formatNumber(bigBlind)}`;
  return ante > 0 ? `${blinds} ante ${formatNumber(ante)}` : blinds;
}
