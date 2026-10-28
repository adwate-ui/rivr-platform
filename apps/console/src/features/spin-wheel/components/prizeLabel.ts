import type { SpinPrizeKind } from '@rivr/db/spin';
import { fromPaise } from '@rivr/domain/money';
import { formatMoney, formatNumber, t } from '@rivr/i18n';

/** A prize as the console names it: `100 points`, `₹500 bonus` or `Nothing`. */
export function prizeLabel(prize: { readonly kind: SpinPrizeKind; readonly amount: bigint }): string {
  if (prize.kind === 'points') return t('console.spin.prizes.points', { points: formatNumber(prize.amount) });
  if (prize.kind === 'bonus') return t('console.spin.prizes.bonus', { amount: formatMoney(fromPaise(prize.amount)) });
  return t('console.spin.prizes.nothing');
}
