import { err, ok, type Result } from '@rivr/contracts/result';
import { compare, isChipMultiple, isPositive, subtract, type Paise } from '../money/index.ts';

/** How a buy-in is paid at the cage (#57): or from the member's bonus in force (#17). */
export type BuyInMethod = 'cash' | 'upi' | 'wallet' | 'bonus';

/** The account a buy-in comes from, against chips outstanding: the cash drawer, the bank, the member's wallet cash or their bonus. */
export type BuyInSource = 'cash_drawer' | 'bank' | 'member_cash' | 'member_bonus';

/** Why a buy-in is refused: not whole ₹50 chips (or nothing), below the table's minimum, or more than the wallet or the bonus in force holds. */
export type BuyInRefusal = 'not_chips' | 'below_minimum' | 'wallet_short' | 'bonus_short';

/** What a member holds that a buy-in can come from: their wallet cash, and their bonus in force (#17). */
export interface BuyInBalances {
  readonly wallet: Paise;
  readonly bonus: Paise;
}

const SOURCE: Readonly<Record<BuyInMethod, BuyInSource>> = { cash: 'cash_drawer', upi: 'bank', wallet: 'member_cash', bonus: 'member_bonus' };

/**
 * A buy-in at the cage (scope-v1 module 5; design prompt flow 3): chips for a seated player, whole
 * ₹50 chips above nothing, at least the table's minimum, and for a wallet or bonus buy-in no more
 * than the wallet cash or the bonus in force (#17). Gives the account the chips are paid from; the cage posts it against chips
 * outstanding. The database's private.buy_in_check is proved equal on packages/testing/golden/cage.json.
 */
export function buyIn(method: BuyInMethod, amount: Paise, minimum: Paise, balances: BuyInBalances): Result<BuyInSource, BuyInRefusal> {
  if (!isPositive(amount) || !isChipMultiple(amount)) return err('not_chips');
  if (compare(amount, minimum) < 0) return err('below_minimum');
  if (method === 'wallet' && compare(amount, balances.wallet) > 0) return err('wallet_short');
  if (method === 'bonus' && compare(amount, balances.bonus) > 0) return err('bonus_short');
  return ok(SOURCE[method]);
}

/** The wallet cash a wallet buy-in leaves; null when the buy-in is not from the wallet, or the wallet cannot cover it. */
export function walletAfter(method: BuyInMethod, amount: Paise, walletCash: Paise): Paise | null {
  if (method !== 'wallet' || !isPositive(amount) || compare(amount, walletCash) > 0) return null;
  return subtract(walletCash, amount);
}
