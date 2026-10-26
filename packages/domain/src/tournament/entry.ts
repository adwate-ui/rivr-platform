import { err, ok, type Result } from '@rivr/contracts/result';
import type { TournamentFormat } from '@rivr/contracts/tournaments';

export { TOURNAMENT_FORMATS, type TournamentFormat } from '@rivr/contracts/tournaments';

/** What a player buys: a first entry, a re-entry after busting, a rebuy of chips, or the add-on. */
export type Purchase = 'entry' | 're_entry' | 'rebuy' | 'add_on';

/** Why a purchase is refused. */
export type PurchaseRefusal =
  | 'registration_closed'
  | 'already_entered'
  | 'not_entered'
  | 'still_playing'
  | 'wrong_format'
  | 'limit_reached'
  | 'no_add_on'
  | 'busted'
  | 'add_on_taken'
  | 'add_on_closed';

/** A tournament's entry rules, from its template. */
export interface EntryRules {
  readonly format: TournamentFormat;
  /** Registration, re-entry and rebuys stay open to the end of this level (and the break after it). */
  readonly lastRegistrationLevel: number;
  /** The most buys a player may make, the first entry included; null for no limit. */
  readonly maxBuys: number | null;
  /** Whether the tournament sells an add-on. */
  readonly hasAddOn: boolean;
}

/** One player's standing in the tournament when they ask. */
export interface PlayerStanding {
  /** Buys so far: the first entry and every re-entry or rebuy. */
  readonly buys: number;
  /** Whether they have chips in play. */
  readonly isAlive: boolean;
  readonly hasTakenAddOn: boolean;
}

/** The clock's level when the player asks: 0 before it starts; a break counts as the level before it. */
type Level = number;

const isRegistrationOpen = (rules: EntryRules, level: Level) => level <= rules.lastRegistrationLevel;
const isAtLimit = (rules: EntryRules, player: PlayerStanding) => rules.maxBuys !== null && player.buys >= rules.maxBuys;

function entryRefusal(rules: EntryRules, level: Level, player: PlayerStanding): PurchaseRefusal | null {
  if (player.buys > 0) return 'already_entered';
  return isRegistrationOpen(rules, level) ? null : 'registration_closed';
}

/** A re-entry or a rebuy: the format's own, after a first entry, while registration is open and within the limit. */
function buyAgainRefusal(purchase: 're_entry' | 'rebuy', rules: EntryRules, level: Level, player: PlayerStanding): PurchaseRefusal | null {
  if (rules.format !== purchase) return 'wrong_format';
  if (player.buys === 0) return 'not_entered';
  // A re-entry is a new entry after busting; a rebuy tops up chips alive or busted.
  if (purchase === 're_entry' && player.isAlive) return 'still_playing';
  if (!isRegistrationOpen(rules, level)) return 'registration_closed';
  return isAtLimit(rules, player) ? 'limit_reached' : null;
}

function addOnRefusal(rules: EntryRules, level: Level, player: PlayerStanding): PurchaseRefusal | null {
  if (!rules.hasAddOn) return 'no_add_on';
  if (player.buys === 0) return 'not_entered';
  if (!player.isAlive) return 'busted';
  if (player.hasTakenAddOn) return 'add_on_taken';
  return level === rules.lastRegistrationLevel ? null : 'add_on_closed';
}

/**
 * Whether a player may make a purchase at the clock's `level` (#116, decision 0202). Every format takes
 * one first entry while registration is open: to the end of the last registration level. A freezeout
 * takes nothing more. A re-entry tournament takes a new entry from a busted player, and a rebuy tournament
 * more chips from a player alive or busted, each while registration is open and within the most buys.
 * An add-on, where sold, is one per player still alive, during the last registration level or the break
 * after it. The database's private.tournament_purchase_refusal is proved equal on
 * packages/testing/golden/tournamentEntry.json.
 */
export function checkPurchase(purchase: Purchase, rules: EntryRules, level: Level, player: PlayerStanding): Result<Purchase, PurchaseRefusal> {
  const refusal = purchase === 'entry' ? entryRefusal(rules, level, player)
    : purchase === 'add_on' ? addOnRefusal(rules, level, player)
    : buyAgainRefusal(purchase, rules, level, player);
  return refusal === null ? ok(purchase) : err(refusal);
}
