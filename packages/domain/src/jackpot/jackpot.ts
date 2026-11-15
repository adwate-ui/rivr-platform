import { shareOf, subtract, type Paise } from '../money/index.ts';

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
