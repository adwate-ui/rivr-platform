import type { Paise } from '@rivr/domain/money';
import type { RakeRules } from '@rivr/domain/rake';

/**
 * Paise as the database gives them: a bigint column, which a check constraint or a setting's schema
 * keeps whole and non-negative. Read here by hand rather than through @rivr/domain's fromPaise, whose
 * schema would carry Zod into every app's main bundle.
 */
export function toPaise(value: number | string): Paise {
  return BigInt(value) as Paise;
}

/** A row of tablet_rake_rules as @rivr/domain's RakeRules, for potTake. */
export function toRakeRules(row: {
  rate_basis_points: number;
  cap_paise: number;
  is_jackpot_live: boolean;
  drop_paise: number;
  drop_above_paise: number;
}): RakeRules {
  return {
    rateBasisPoints: BigInt(row.rate_basis_points),
    cap: toPaise(row.cap_paise),
    isJackpotLive: row.is_jackpot_live,
    drop: toPaise(row.drop_paise),
    dropAbove: toPaise(row.drop_above_paise),
  };
}
