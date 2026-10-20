import type { Movement, MovementKind } from '@rivr/db';
import { formatMoney, t, type MessageKey } from '@rivr/i18n';

/** What each kind of movement is called on Balance. */
const KIND_COPY: Readonly<Record<MovementKind, MessageKey>> = {
  buy_in: 'player.balance.kindBuyIn',
  cash_out: 'player.balance.kindCashOut',
  marker: 'player.balance.kindMarker',
  bonus: 'player.balance.kindBonus',
  bonus_expiry: 'player.balance.kindBonusExpiry',
  withdrawal: 'player.balance.kindWithdrawal',
  withdrawal_return: 'player.balance.kindWithdrawalReturn',
  reversal: 'player.balance.kindReversal',
  opening_balance: 'player.balance.kindOpeningBalance',
  other: 'player.balance.kindOther',
};

/** A movement's line: what it was, and where it happened, a bonus's reason or a withdrawal's bank: "Cash-out · Table 2". */
export function movementTitle(movement: Movement): string {
  const title = t(KIND_COPY[movement.kind]);
  const detail = movement.tableName ?? movement.bonusReason ?? movement.bankName;
  return detail === null ? title : t('player.balance.movementAt', { title, detail });
}

/** A marker line in words: more owed on markers, or some of it repaid. */
export function markerWords(movement: Movement): string {
  const owedMore = movement.amount > 0n;
  return t(owedMore ? 'player.balance.owed' : 'player.balance.repaid', { amount: formatMoney(owedMore ? movement.amount : -movement.amount) });
}