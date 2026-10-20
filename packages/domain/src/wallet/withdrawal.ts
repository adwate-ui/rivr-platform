import { err, ok, type Result } from '@rivr/contracts/result';
import { compare, isPositive, type Paise } from '../money/index.ts';

/** Why a withdrawal is refused: not whole rupees above nothing, or more than the wallet's cash. */
export type WithdrawalRefusal = 'not_rupees' | 'wallet_short';

const PAISE_PER_RUPEE = 100n;

/**
 * A withdrawal from the member's wallet (#21; scope-v1 module 5; design prompt flow 9): whole rupees
 * above nothing, and no more than the wallet's cash; bonus and points are never withdrawn. The
 * database's private.withdrawal_check is proved equal on packages/testing/golden/wallet.json.
 */
export function withdrawalCheck(amount: Paise, walletCash: Paise): Result<null, WithdrawalRefusal> {
  if (!isPositive(amount) || amount % PAISE_PER_RUPEE !== 0n) return err('not_rupees');
  if (compare(amount, walletCash) > 0) return err('wallet_short');
  return ok(null);
}
