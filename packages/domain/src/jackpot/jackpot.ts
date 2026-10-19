import { add, fromPaise, roundDownToChip, shareOf, subtract, times, ZERO, type Paise } from '../money/index.ts';

const WHOLE_IN_BASIS_POINTS = 10_000n;

/** The season and freeroll pools' shares of every drop, in basis points (2000 is 20%); the main pool takes the rest. */
export interface DropShares {
  readonly season: bigint;
  readonly freeroll: bigint;
}

/** A drop as it lands in the three pools. */
export interface PoolSplit {
  readonly main: Paise;
  readonly season: Paise;
  readonly freeroll: Paise;
}

/** How a bad beat pays, in basis points: the share of the main pool paid, and its split between the loser, the winner and the other players dealt in (together 100%). */
export interface PayoutRule {
  readonly poolShare: bigint;
  readonly loser: bigint;
  readonly winner: bigint;
  readonly table: bigint;
}

/** A bad beat's payout in chips: the loser's, the winner's, each other player's, and all of it together. */
export interface BadBeatPayout {
  readonly loser: Paise;
  readonly winner: Paise;
  readonly eachAtTable: Paise;
  readonly total: Paise;
}

/**
 * Splits a jackpot drop between the pools (additions, "Jackpot sub-pools"). The season and freeroll
 * pools take their shares rounded down to the paisa and the main pool takes the rest, so the parts
 * always add up to the drop. Shares below nothing or together above 100% are a bug in the caller.
 */
export function splitDrop(drop: Paise, shares: DropShares): PoolSplit {
  if (shares.season < 0n || shares.freeroll < 0n || shares.season + shares.freeroll > WHOLE_IN_BASIS_POINTS) {
    throw new RangeError(`The season and freeroll shares (${shares.season} and ${shares.freeroll} basis points) are not 0% to 100% together`);
  }
  const season = shareOf(drop, shares.season);
  const freeroll = shareOf(drop, shares.freeroll);
  return { main: subtract(subtract(drop, season), freeroll), season, freeroll };
}

/**
 * What a bad beat pays from the main pool (scope-v1 module 8), in chips at the table: the rule's
 * share of the pool, split between the loser, the winner and the `others` dealt in. The loser's and
 * winner's parts round down to whole ₹50 chips; the table's part is shared equally and each share
 * rounds down to ₹50. What rounds away, and the table's part when nobody else was dealt in, stays in
 * the pool. A split that is not 100%, or a count of others below nought, is a bug in the caller.
 */
export function badBeatPayout(pool: Paise, rule: PayoutRule, others: number): BadBeatPayout {
  if (rule.loser + rule.winner + rule.table !== WHOLE_IN_BASIS_POINTS) {
    throw new RangeError(`A payout splits 100% between loser, winner and table, not ${rule.loser + rule.winner + rule.table} basis points`);
  }
  if (!Number.isInteger(others) || others < 0) throw new RangeError(`The other players dealt in are a count, not ${others}`);
  const paid = shareOf(pool, rule.poolShare);
  const loser = roundDownToChip(shareOf(paid, rule.loser));
  const winner = roundDownToChip(shareOf(paid, rule.winner));
  // Shares are never negative, so bigint division rounds the table's part down to the paisa.
  const eachAtTable = others === 0 ? ZERO : roundDownToChip(fromPaise(shareOf(paid, rule.table) / BigInt(others)));
  return { loser, winner, eachAtTable, total: add(add(loser, winner), times(eachAtTable, BigInt(others))) };
}
