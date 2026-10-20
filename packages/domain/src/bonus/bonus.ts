import { err, ok, type Result } from '@rivr/contracts/result';
import { add, compare, isChipMultiple, isPositive, min, subtract, ZERO, type Paise } from '../money/index.ts';

/** A bonus grant (#17): what is left of it, and when it ends. It is usable before that moment, never at it. */
export interface BonusGrant {
  readonly remaining: Paise;
  readonly expiresAt: Date;
}

/** Why a spend of bonus is refused: not whole ₹50 chips (or nothing), or more than the bonus in force. */
export type BonusRefusal = 'not_chips' | 'bonus_short';

/** Whether a grant can still be spent at `at`: something left, and its end still to come. */
function inForce(grant: BonusGrant, at: Date): boolean {
  return isPositive(grant.remaining) && grant.expiresAt > at;
}

/** The bonus a member can spend at `at`: what is left of every grant in force. */
export function bonusAvailable(grants: readonly BonusGrant[], at: Date): Paise {
  return grants.filter((grant) => inForce(grant, at)).reduce((sum, grant) => add(sum, grant.remaining), ZERO);
}

/**
 * A spend of bonus on chips (#17; scope-v1 module 5, "bonus is playable, not withdrawable"): whole ₹50
 * chips, drawn from the grants in force, the soonest to end first (in the order given when two end
 * together), each as far as it goes. Gives what each grant gives, in the order given (nothing from a
 * grant not drawn on). The database's private.bonus_draws is proved equal by packages/testing/golden/bonus.json.
 */
export function bonusSpend(amount: Paise, grants: readonly BonusGrant[], at: Date): Result<Paise[], BonusRefusal> {
  if (!isPositive(amount) || !isChipMultiple(amount)) return err('not_chips');
  if (compare(amount, bonusAvailable(grants, at)) > 0) return err('bonus_short');
  const order = grants.map((grant, index) => ({ grant, index })).filter(({ grant }) => inForce(grant, at))
    .sort((a, b) => a.grant.expiresAt.getTime() - b.grant.expiresAt.getTime() || a.index - b.index);
  const taken: Paise[] = grants.map(() => ZERO);
  let left = amount;
  for (const { grant, index } of order) {
    const take = min(left, grant.remaining);
    taken[index] = take;
    left = subtract(left, take);
  }
  return ok(taken);
}

/** What expires at `at`: the remainder of each grant whose end has come (nothing from one still in force), in the order given. */
export function bonusExpired(grants: readonly BonusGrant[], at: Date): Paise[] {
  return grants.map((grant) => (grant.expiresAt <= at && isPositive(grant.remaining) ? grant.remaining : ZERO));
}
