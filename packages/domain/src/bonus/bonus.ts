import { err, ok, type Result } from '@rivr/contracts/result';
import { add, compare, isChipMultiple, isPositive, max, min, roundDownToChip, shareOf, subtract, ZERO, type Paise } from '../money/index.ts';

const DAY_MS = 86_400_000;
/** The longest expiry the setting allows, ten years. */
const MOST_DAYS = 3650;

/**
 * A bonus grant (#17): what is left of it, and when it ends. It is usable before that moment, never at it. Bonus chips
 * given since decision 0504 never end (`null`); grants given before it keep the end they had.
 */
export interface BonusGrant {
  readonly remaining: Paise;
  readonly expiresAt: Date | null;
}

/** Why a spend of bonus is refused: not whole ₹50 chips (or nothing), or more than the bonus in force. */
export type BonusRefusal = 'not_chips' | 'bonus_short';

/** Whether a grant has ended by `at`: one with no end never has. */
function hasEnded(grant: BonusGrant, at: Date): boolean {
  return grant.expiresAt !== null && grant.expiresAt <= at;
}

/** Whether a grant can still be spent at `at`: something left, and not ended. */
function inForce(grant: BonusGrant, at: Date): boolean {
  return isPositive(grant.remaining) && !hasEnded(grant, at);
}

/** When a grant ends, as a number to sort by: one with no end sorts after every end. */
function endOrder(grant: BonusGrant): number {
  return grant.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
}

/** The bonus a member can spend at `at`: what is left of every grant in force. */
export function bonusAvailable(grants: readonly BonusGrant[], at: Date): Paise {
  return grants.filter((grant) => inForce(grant, at)).reduce((sum, grant) => add(sum, grant.remaining), ZERO);
}

/**
 * A spend of bonus on chips (#17; scope-v1 module 5, "bonus is playable, not withdrawable"): whole ₹50
 * chips, drawn from the grants in force, the soonest to end first and those with no end last (in the order
 * given when two end together, or neither ends: the oldest first), each as far as it goes. Gives what each
 * grant gives, in the order given (nothing from a grant not drawn on). The database's private.bonus_draws is
 * proved equal by packages/testing/golden/bonus.json.
 */
export function bonusSpend(amount: Paise, grants: readonly BonusGrant[], at: Date): Result<Paise[], BonusRefusal> {
  if (!isPositive(amount) || !isChipMultiple(amount)) return err('not_chips');
  if (compare(amount, bonusAvailable(grants, at)) > 0) return err('bonus_short');
  const order = grants.map((grant, index) => ({ grant, index })).filter(({ grant }) => inForce(grant, at))
    .sort((a, b) => compareEnds(a.grant, b.grant) || a.index - b.index);
  const taken: Paise[] = grants.map(() => ZERO);
  let left = amount;
  for (const { grant, index } of order) {
    const take = min(left, grant.remaining);
    taken[index] = take;
    left = subtract(left, take);
  }
  return ok(taken);
}

/** Negative when `a` ends first, positive when `b` does, 0 when they end together or neither ends. */
function compareEnds(a: BonusGrant, b: BonusGrant): number {
  const [first, second] = [endOrder(a), endOrder(b)];
  return first === second ? 0 : first < second ? -1 : 1;
}

/**
 * When a grant ends once a venue makes bonus chips expire (the owner, 12 Nov; decision 0579): `days` after it was given, or
 * after expiry was switched on (`since`) for chips held before then; never with expiry off (0 days). Ending N days after it
 * was given, every grant ends in the order it was given, so bonusSpend draws the oldest first. Throws on days outside 0 to
 * 3,650, because that is a bug in the caller. The database's private.bonus_end is proved equal by bonus.json.
 */
export function bonusEnd(givenAt: Date, days: number, since: Date): Date | null {
  if (!Number.isInteger(days) || days < 0 || days > MOST_DAYS) throw new RangeError(`Bonus chips expire after 0 to ${String(MOST_DAYS)} days, not ${String(days)}`);
  if (days === 0) return null;
  return new Date(Math.max(givenAt.getTime(), since.getTime()) + days * DAY_MS);
}

/**
 * How many days Bonus lasts after it is given, for the line under a member's balance (redesign RD-20): the venue's
 * bonus.expiry_days as it is in force; null is never, which is what 0 days and no setting at all both mean (decision 0579).
 */
export function bonusLastsDays(days: number | null): number | null {
  return days === null || days <= 0 ? null : days;
}

/**
 * The most bonus a member may redeem in one visit (the owner, 12 Nov; decision 0579): `basisPoints` (5,000 is half) of the
 * bonus they held at the visit's first seat, rounded down to whole ₹50 chips. private.visit_bonus_cap is its twin.
 */
export function visitBonusCap(heldAtFirstSeat: Paise, basisPoints: bigint): Paise {
  return roundDownToChip(shareOf(heldAtFirstSeat, basisPoints));
}

/** What a visit may still redeem: its cap less what it has redeemed, never below nothing. private.visit_bonus_left is its twin. */
export function visitBonusLeft(cap: Paise, redeemed: Paise): Paise {
  return max(ZERO, subtract(cap, redeemed));
}

/** What expires at `at`: the remainder of each grant whose end has come (nothing from one in force or with no end), in the order given. */
export function bonusExpired(grants: readonly BonusGrant[], at: Date): Paise[] {
  return grants.map((grant) => (hasEnded(grant, at) && isPositive(grant.remaining) ? grant.remaining : ZERO));
}

/** Bonus taken back: what each grant gives, in the order given, and what they could not give, which is owed. */
export interface BonusTaken {
  readonly taken: Paise[];
  readonly owed: Paise;
}

/**
 * Bonus taken back after the fact (the owner, 18 Nov; #1077): a reversal's whole amount, or a use added for a seat that
 * missed it. Drawn first from the grant `first` (the one reversed; null for a use) as far as it goes, whether or not it has
 * ended, as its remainder goes back now and never again at expiry; then from the other grants in force in bonusSpend's
 * order, each as far as it goes. What they cannot give is owed: the balance is below nothing until new Bonus pays it
 * (bonusPayOff). Never refused, in any whole paise. Throws on an amount below nothing or a `first` not in the list, which
 * is a bug in the caller. The database's private.bonus_takes is proved equal by packages/testing/golden/bonus.json.
 */
export function bonusTake(amount: Paise, grants: readonly BonusGrant[], at: Date, first: number | null): BonusTaken {
  if (compare(amount, ZERO) < 0) throw new RangeError('Bonus taken back is never below nothing');
  if (first !== null && (first < 0 || first >= grants.length)) throw new RangeError(`No grant ${String(first)} to take back from`);
  const order = grants.map((grant, index) => ({ grant, index, isFirst: index === first }))
    .filter(({ grant, isFirst }) => isFirst || inForce(grant, at))
    .sort((a, b) => Number(b.isFirst) - Number(a.isFirst) || compareEnds(a.grant, b.grant) || a.index - b.index);
  const taken: Paise[] = grants.map(() => ZERO);
  let left = amount;
  for (const { grant, index } of order) {
    const take = min(left, grant.remaining);
    taken[index] = take;
    left = subtract(left, take);
  }
  return { taken, owed: left };
}

/** Bonus given while some is owed: what pays what is owed, and what the member keeps as Bonus. */
export interface BonusPaidOff {
  readonly paid: Paise;
  readonly kept: Paise;
}

/**
 * Bonus given while some is owed (the owner, 18 Nov; #1077): it pays what is owed first, as far as it goes, and the member
 * keeps the rest. Nothing owed, or nothing given, pays nothing. private.bonus_pay_off is its twin.
 */
export function bonusPayOff(given: Paise, owed: Paise): BonusPaidOff {
  const paid = max(ZERO, min(given, owed));
  return { paid, kept: subtract(given, paid) };
}
