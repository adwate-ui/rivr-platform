/** Why tournament changes and buys are refused, from the database's error codes; apart so Home carries only this. */
import { PURCHASE_REFUSALS, type PurchaseRefusal } from '@rivr/domain/tournament';

/** Why a tournament change was refused: the role, something out of bounds, a name taken, something refers to it, the venue frozen, or anything else. */
export type TournamentFailure = 'not_allowed' | 'invalid' | 'taken' | 'in_use' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TournamentFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23505': 'taken', '23503': 'in_use', RVFRZ: 'paused', RVMBR: 'paused',
};

/** Why the clock did not change: as any tournament change, or Day 2 with a flight still to bag (#524). */
export type ClockFailure = TournamentFailure | 'flights_unbagged';

/** What a refused clock change means: Day 2's flights unbagged from the hint, or the code's. */
export function toClockFailure(error: { code: string; hint?: string | null }): ClockFailure {
  return error.code === 'RVTRN' && error.hint === 'flights_unbagged' ? 'flights_unbagged' : tournamentFailure(error.code);
}

/** The failure a database error code means. */
export function tournamentFailure(code: string): TournamentFailure {
  return FAILURE_BY_CODE[code] ?? 'unavailable';
}

/**
 * Why setting payouts or finishing was refused (#121): the tournament's own state (the payouts not set,
 * an alternate waiting, the wrong number of players left for how it finishes, finished already), or why
 * any tournament change is.
 */
export type FinishFailure =
  | TournamentFailure | 'payouts_unset' | 'alternates_waiting' | 'players_left' | 'shares_locked' | 'finished' | 'tds_switched_on' | 'room_full';
const FINISH_STATES: readonly FinishFailure[] = [
  'payouts_unset', 'alternates_waiting', 'players_left', 'shares_locked', 'finished', 'tds_switched_on', 'room_full',
];

/** What a refused finish or payout setting means: the state from the hint, or the code's. */
export function toFinishFailure(error: { code: string; hint?: string | null }): FinishFailure {
  if (error.code === 'RVTRN') return FINISH_STATES.find((state) => state === error.hint) ?? 'unavailable';
  return tournamentFailure(error.code);
}

/** Why a buy was refused: the rules' reason (decision 0202), no free seat for a busted player's rebuy, or the wallet's or the cage's. */
export type BuyFailure =
  | TournamentFailure | PurchaseRefusal | 'room_full' | 'finished' | 'no_ticket' | 'day_two' | 'day_two_started' | 'short' | 'identity' | 'on_break' | 'switched_off' | 'no_shift'
  | 'own_record';

const BUY_FAILURE_BY_CODE: Readonly<Record<string, BuyFailure>> = {
  RVSHT: 'short', RVKYC: 'identity', RVAGE: 'identity', RVDUP: 'identity', RVBRK: 'on_break', RVKIL: 'switched_off', RVNSH: 'no_shift', RVOWN: 'own_record',
};
const RULE_REFUSALS: readonly BuyFailure[] = [...PURCHASE_REFUSALS, 'room_full', 'finished', 'no_ticket', 'day_two', 'day_two_started'];

/** What a refused buy means: the rules' reason from the hint, or the code's. */
export function toBuyFailure(error: { code: string; hint?: string | null }): BuyFailure {
  if (error.code === 'RVTRN') return RULE_REFUSALS.find((reason) => reason === error.hint) ?? 'unavailable';
  return BUY_FAILURE_BY_CODE[error.code] ?? tournamentFailure(error.code);
}

