import { DEAL_METHODS } from '@rivr/contracts/tournaments';
import { CHIP, fromPaise, isChipMultiple, type Paise } from '../money/index.ts';

export { DEAL_METHODS };

/** The most players a deal is worked for: a final table. */
export const MOST_DEAL_PLAYERS = 9;

/** How a deal shares the prizes left among the players left (#121; decision 0205). */
export type DealMethod = (typeof DEAL_METHODS)[number];

/** ICM works its chances to thirty decimal places, rounding down; each value then rounds to the nearest paisa. */
const SCALE = 10n ** 30n;

/** Two to nine players, each with chips, and one prize (nothing or more, in ₹50 chips) for each; anything else is a bug and throws. */
function checkDeal(stacks: readonly bigint[], prizes: readonly Paise[]): void {
  if (stacks.length < 2 || stacks.length > MOST_DEAL_PLAYERS || stacks.length !== prizes.length) {
    throw new RangeError('Two to nine players, one prize each');
  }
  if (stacks.some((stack) => stack <= 0n) || prizes.some((prize) => prize < 0n || !isChipMultiple(prize))) {
    throw new RangeError('Stacks above nothing and prizes in ₹50 chips');
  }
}

const total = (values: readonly bigint[]) => values.reduce((sum, value) => sum + value, 0n);
/** The smallest prize left, in whole chips: every player in a deal is sure of it. */
const smallestChips = (prizes: readonly Paise[]) => prizes.reduce((least, prize) => (prize < least ? prize : least)) / CHIP;

/** Whole chips to each player in paise, the chips left over from the prizes to the biggest stack (the first on a tie). */
function settle(shares: readonly bigint[], stacks: readonly bigint[], prizes: readonly Paise[]): Paise[] {
  const biggest = stacks.indexOf(stacks.reduce((most, stack) => (stack > most ? stack : most)));
  const left = total(prizes) / CHIP - total(shares);
  return shares.map((share, index) => fromPaise((index === biggest ? share + left : share) * CHIP));
}

/**
 * A chip-chop deal (#121; decision 0205): every player is sure of the smallest prize left, and the rest of
 * the prizes is shared in proportion to their chips, each share rounded down to ₹50 chips; the chips left
 * over go to the biggest stack. `stacks` and the result are in the same order; `prizes` are the prizes the
 * players left would play for, first place first. The database's private.tournament_chip_chop is proved
 * equal on tournamentPayouts.json.
 */
export function chipChop(stacks: readonly bigint[], prizes: readonly Paise[]): Paise[] {
  checkDeal(stacks, prizes);
  const floor = smallestChips(prizes);
  const rest = total(prizes) / CHIP - floor * BigInt(prizes.length);
  const chips = total(stacks);
  return settle(stacks.map((stack) => floor + (rest * stack) / chips), stacks, prizes);
}

/** The players in a set of players, as the set's bits. */
const inSet = (set: number, player: number) => Math.floor(set / 2 ** player) % 2 === 1;

/**
 * Malmuth-Harville: going down the places, each player not yet placed takes the next place with the
 * chance of their share of the chips not yet placed. `reach[set]` is the chance that the players in the
 * set took the top places; each step adds that player's chance of the next place times its prize.
 */
function icmEquity(stacks: readonly bigint[], prizes: readonly bigint[]): bigint[] {
  const chips = total(stacks);
  const reach = Array.from({ length: 2 ** stacks.length }, (_, set) => (set === 0 ? SCALE : 0n));
  const equity = stacks.map(() => 0n);
  reach.forEach((_, set) => {
    const placed = stacks.filter((_stack, player) => inSet(set, player));
    const left = chips - total(placed);
    stacks.forEach((stack, player) => {
      if (inSet(set, player)) return;
      const chance = ((reach[set] ?? 0n) * stack) / left;
      const next = set + 2 ** player;
      reach[next] = (reach[next] ?? 0n) + chance;
      equity[player] = (equity[player] ?? 0n) + chance * (prizes[placed.length] ?? 0n);
    });
  });
  return equity;
}

/**
 * An ICM deal (#121; decision 0205): each player gets the smallest prize left, which every finish pays,
 * and what their chips are worth by the Independent Chip Model (Malmuth-Harville) over the rest of each
 * prize, to the nearest paisa and then down to ₹50 chips; the chips left over go to the biggest stack. (That is the model's
 * value over the whole prizes; worked this way, rounding the chances never leaves anyone below the
 * smallest prize.) `stacks` and the result are in the same order; `prizes` are first place first. The
 * database's private.tournament_icm is proved equal on tournamentPayouts.json.
 */
export function icmDeal(stacks: readonly bigint[], prizes: readonly Paise[]): Paise[] {
  checkDeal(stacks, prizes);
  const floor = smallestChips(prizes);
  const above = prizes.map((prize) => prize - floor * CHIP);
  // Each value to the nearest paisa (the chances' rounding never moves a whole paisa), then down to chips.
  return settle(icmEquity(stacks, above).map((value) => floor + (value + SCALE / 2n) / SCALE / CHIP), stacks, prizes);
}

/** A deal by its method. */
export function dealAmounts(method: DealMethod, stacks: readonly bigint[], prizes: readonly Paise[]): Paise[] {
  return method === 'icm' ? icmDeal(stacks, prizes) : chipChop(stacks, prizes);
}
