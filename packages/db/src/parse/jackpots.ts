import type { PayoutRule } from '@rivr/domain/jackpot';
import type { Json } from '../database.types.ts';

/**
 * The venue's jackpot.payout setting as @rivr/domain's PayoutRule, for badBeatPayout's preview; null
 * when none is set. Its value matches the setting's schema, which the database checks on insert.
 */
export function toPayoutRule(value: Json | null): PayoutRule | null {
  if (value === null) return null;
  const rule = value as { pool_basis_points: number; loser_basis_points: number; winner_basis_points: number; table_basis_points: number };
  return {
    poolShare: BigInt(rule.pool_basis_points),
    loser: BigInt(rule.loser_basis_points),
    winner: BigInt(rule.winner_basis_points),
    table: BigInt(rule.table_basis_points),
  };
}
