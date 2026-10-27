import type { Paise } from '../money/index.ts';

/**
 * AML cash limits and structuring (#105; scope-v1 module 12; decision 0234; golden aml.json). Twins in SQL:
 * private.cash_limit_hit and private.is_near_limit.
 */

/** The cash buy-in limits in force: per visit and per club day (06:00 to 06:00 IST). Nothing, or null, is no limit there. */
export interface CashLimits {
  readonly perVisit: Paise | null;
  readonly perDay: Paise | null;
}

/** Which limit a cash buy-in would take the member past. */
export type CashLimitHit = 'visit' | 'day';

const isLimit = (limit: Paise | null): limit is Paise => limit !== null && limit > 0n;

/**
 * Which limit a cash buy-in of `amount` would take the member's cash buy-ins past, the visit's checked first, or
 * null when it is within both. Reaching a limit exactly is within it.
 */
export function cashLimitHit(limits: CashLimits, visitSoFar: Paise, daySoFar: Paise, amount: Paise): CashLimitHit | null {
  if (isLimit(limits.perVisit) && visitSoFar + amount > limits.perVisit) return 'visit';
  if (isLimit(limits.perDay) && daySoFar + amount > limits.perDay) return 'day';
  return null;
}

/**
 * Whether a total ended just under a limit: within `marginBasisPoints` of it (1,000 is 10%), the limit itself
 * included. The margin is rounded down to the paisa. Nothing is near no limit, and nothing bought is near none.
 */
export function isNearLimit(total: Paise, limit: Paise | null, marginBasisPoints: number): boolean {
  if (!isLimit(limit) || total <= 0n || total > limit) return false;
  return total >= limit - (limit * BigInt(marginBasisPoints)) / 10_000n;
}
