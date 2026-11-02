/** A reward priced in points: hotel nights carry none and are never the next one. */
export interface PricedReward {
  readonly points: bigint | null;
}

/** The next reward, how many points short the member is, and how far along, 0 to 1: the bar under the balance. */
export interface NextReward<Item extends PricedReward> {
  readonly item: Item;
  readonly gap: bigint;
  readonly fraction: number;
}

/**
 * The cheapest reward priced above the member's points (brief 3.8, decision 0320), with the gap and the share already held;
 * null when every reward in points is within reach or none is priced in points.
 */
export function nextReward<Item extends PricedReward>(balance: bigint, items: readonly Item[]): NextReward<Item> | null {
  let next: (Item & { points: bigint }) | null = null;
  for (const item of items) {
    const { points } = item;
    if (points !== null && points > balance && (next === null || points < next.points)) next = { ...item, points };
  }
  if (next === null) return null;
  const fraction = balance <= 0n ? 0 : Number(balance) / Number(next.points);
  return { item: next, gap: next.points - balance, fraction };
}
