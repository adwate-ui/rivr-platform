import { BOUNTY_KINDS } from '@rivr/contracts/tournaments';
import { CHIP, fromPaise, isChipMultiple, roundDownToChip, subtract, type Paise } from '../money/index.ts';

export { BOUNTY_KINDS };

/** The most places a template pays (decision 0200). */
export const MOST_PLACES = 100;

/** A tournament's prize pool, and the overlay the club adds to reach a guarantee. */
export interface PrizePool {
  readonly pool: Paise;
  readonly overlay: Paise;
}

/**
 * The prize pool (#117, #121; decision 0205): what the buys put in for prizes (their prices less the fees
 * and the bounties), or the guarantee when that is more, the club paying the difference as overlay
 * (venue.tournament_overlay). Below nothing is a bug and throws. The database's
 * private.tournament_prize_pool is proved equal on tournamentPayouts.json.
 */
export function prizePool(collected: Paise, guarantee: Paise | null): PrizePool {
  if (collected < 0n || (guarantee !== null && guarantee < 0n)) throw new RangeError('A pool and a guarantee are nothing or more');
  const pool = guarantee !== null && guarantee > collected ? guarantee : collected;
  return { pool, overlay: subtract(pool, collected) };
}

/** A whole pool, in basis points: the paid places' shares add up to it. */
export const WHOLE_POOL = 10_000;

/** One to a hundred shares in basis points, each above nothing and no more than the place above's, adding up to the whole pool. */
export function areSharesWhole(shares: readonly number[]): boolean {
  return shares.length >= 1 && shares.length <= MOST_PLACES
    && shares.every((share, index) => Number.isInteger(share) && share > 0 && share <= (shares[index - 1] ?? WHOLE_POOL))
    && shares.reduce((sum, share) => sum + share, 0) === WHOLE_POOL;
}

/**
 * The prizes, first place first (#121; decision 0205, question #470): the floor sets each paid place's
 * share of the pool for the tournament, in basis points adding up to 100%, none above the place before's
 * (the order is ours, so a lower place never pays more). With fewer runs than paid
 * places, the places that exist share the pool in the same proportions. Each prize is rounded down to ₹50
 * chips and the chips left over go to first, so the whole pool is always paid. Shares that are not whole,
 * no runs, or a pool not in ₹50 chips are a bug and throw. The database's private.tournament_payout_table
 * is proved equal on tournamentPayouts.json.
 */
export function payoutTable(pool: Paise, shares: readonly number[], runs: number): Paise[] {
  if (!areSharesWhole(shares) || !Number.isInteger(runs) || runs < 1) throw new RangeError('Shares adding up to 100%, and a run');
  if (pool < 0n || !isChipMultiple(pool)) throw new RangeError('A pool in ₹50 chips');
  const chips = pool / CHIP;
  const weights = shares.slice(0, runs).map(BigInt);
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  const prizes = weights.map((weight) => (chips * weight) / total);
  const left = chips - prizes.reduce((sum, prize) => sum + prize, 0n);
  return prizes.map((prize, index) => fromPaise((index === 0 ? prize + left : prize) * CHIP));
}

/** How a bounty tournament pays a player's bounty (#117): all of it, or half, the other half on the eliminator's own head. */
export type BountyKind = (typeof BOUNTY_KINDS)[number];

/** A bust's bounty: what the player who knocked them out is paid, and what goes on that player's own head. */
export interface BountySplit {
  readonly paid: Paise;
  readonly toHead: Paise;
}

/**
 * A busted player's bounty (#117; decision 0206). A standard bounty pays all of it to the player who
 * knocked them out. A progressive bounty pays half, rounded down to ₹50 chips, and puts the rest on that
 * player's own head, which grows until they bust or win. A bounty below nothing or not in ₹50 chips is a
 * bug and throws. The database's private.tournament_bounty_split is proved equal on tournamentPayouts.json.
 */
export function bountyOnBust(bounty: Paise, kind: BountyKind): BountySplit {
  if (bounty < 0n || !isChipMultiple(bounty)) throw new RangeError('A bounty in ₹50 chips');
  const paid = kind === 'standard' ? bounty : roundDownToChip(fromPaise(bounty / 2n));
  return { paid, toHead: subtract(bounty, paid) };
}
