import type { Wallet, Withdrawal } from '@rivr/db';
import { isPastDue } from '@rivr/domain/markers';
import type { MessageKey } from '@rivr/i18n';

/**
 * Why Withdraw is blocked before the member types anything, as the prototype has it: a withdrawal
 * already waiting for the cage, or a marker past due (#55). Null when neither; the database refuses
 * both again whatever this says.
 */
export function withdrawBlock(markers: Wallet['markers'], withdrawals: readonly Withdrawal[], now: Date): MessageKey | null {
  if (withdrawals.some((withdrawal) => withdrawal.status === 'waiting')) return 'player.balance.withdrawAlreadyWaiting';
  return markers.some((marker) => isPastDue(new Date(marker.dueAt), now)) ? 'player.balance.withdrawMarkerPastDue' : null;
}
