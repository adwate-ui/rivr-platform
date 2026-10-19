import type { Paise } from '@rivr/domain/money';
import type { Json } from '../database.types.ts';
import { toPaise } from './hands.ts';

/** One rake.config row: a table type's rate and cap from a time. */
export interface RakeSetting {
  readonly settingId: string;
  readonly rateBasisPoints: number;
  readonly cap: Paise;
  /** When it takes effect; null for a rule in force since the venue opened (stored as -infinity). */
  readonly effectiveFrom: string | null;
  readonly reason: string | null;
}

/**
 * A rake.config row as the console shows it. Its value matches the setting's schema, which the
 * database checks on every insert, so it is read here as that shape.
 */
export function toRakeSetting(row: { id: string; value: Json; effective_from: string; reason: string | null }): RakeSetting {
  const value = row.value as { rate_basis_points: number; cap_paise: number };
  return {
    settingId: row.id,
    rateBasisPoints: value.rate_basis_points,
    cap: toPaise(value.cap_paise),
    effectiveFrom: row.effective_from === '-infinity' ? null : row.effective_from,
    reason: row.reason,
  };
}
