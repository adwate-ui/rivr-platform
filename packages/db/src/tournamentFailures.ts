/** Why tournament changes and buys are refused, from the database's error codes; apart so Home carries only this. */
import { PURCHASE_REFUSALS, type PurchaseRefusal } from '@rivr/domain/tournament';

/** Why a tournament change was refused: the role, something out of bounds, a name taken, something refers to it, the venue frozen, or anything else. */
export type TournamentFailure = 'not_allowed' | 'invalid' | 'taken' | 'in_use' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TournamentFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23505': 'taken', '23503': 'in_use', RVFRZ: 'paused',
};

/** The failure a database error code means. */
export function tournamentFailure(code: string): TournamentFailure {
  return FAILURE_BY_CODE[code] ?? 'unavailable';
}

/** Why a buy was refused: the rules' reason (decision 0202), no free seat for a busted player's rebuy, or the wallet's or the cage's. */
export type BuyFailure =
  | TournamentFailure | PurchaseRefusal | 'room_full' | 'short' | 'identity' | 'on_break' | 'switched_off' | 'no_shift';

const BUY_FAILURE_BY_CODE: Readonly<Record<string, BuyFailure>> = {
  RVSHT: 'short', RVKYC: 'identity', RVAGE: 'identity', RVDUP: 'identity', RVBRK: 'on_break', RVKIL: 'switched_off', RVNSH: 'no_shift',
};
const RULE_REFUSALS: readonly BuyFailure[] = [...PURCHASE_REFUSALS, 'room_full'];

/** What a refused buy means: the rules' reason from the hint, or the code's. */
export function toBuyFailure(error: { code: string; hint?: string | null }): BuyFailure {
  if (error.code === 'RVTRN') return RULE_REFUSALS.find((reason) => reason === error.hint) ?? 'unavailable';
  return BUY_FAILURE_BY_CODE[error.code] ?? tournamentFailure(error.code);
}

