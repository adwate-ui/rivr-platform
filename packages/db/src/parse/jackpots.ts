import type { PayoutRule } from '@rivr/domain/jackpot';
import type { Json } from '../database.types.ts';

const WHOLE = 10_000n;

/**
 * The venue's jackpot.payout setting as @rivr/domain's PayoutRule, for badBeatPayout's preview; null
 * when none is set, or when the one set does not split 100% (the database's schema checks each share
 * but not their sum, and pay_bad_beat refuses such a rule), so the screen shows no payout form rather
 * than failing.
 */
export function toPayoutRule(value: Json | null): PayoutRule | null {
  if (value === null) return null;
  const setting = value as { pool_basis_points: number; loser_basis_points: number; winner_basis_points: number; table_basis_points: number };
  const rule = {
    poolShare: BigInt(setting.pool_basis_points),
    loser: BigInt(setting.loser_basis_points),
    winner: BigInt(setting.winner_basis_points),
    table: BigInt(setting.table_basis_points),
  };
  const isWithinWhole = [rule.poolShare, rule.loser, rule.winner, rule.table].every((share) => share >= 0n && share <= WHOLE);
  return isWithinWhole && rule.loser + rule.winner + rule.table === WHOLE ? rule : null;
}
