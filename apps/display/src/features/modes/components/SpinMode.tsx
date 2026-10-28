import { useTvSpinWheel, type SpinPrizeKind, type TvSpinWheel } from '@rivr/db/spin';
import { fromPaise } from '@rivr/domain/money';
import { formatMoney, formatNumber, t } from '@rivr/i18n';
import { Text, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';

/** A prize as the TV names it: `100 points`, `₹500 bonus` or `Nothing`. */
function prizeLabel(prize: { readonly kind: SpinPrizeKind; readonly amount: bigint }): string {
  if (prize.kind === 'points') return t('tv.spin.points', { points: formatNumber(prize.amount) });
  if (prize.kind === 'bonus') return t('tv.spin.bonus', { amount: formatMoney(fromPaise(prize.amount)) });
  return t('tv.spin.nothing');
}

/** The wheel as the board's two columns: its prizes in order with their odds, and tonight's spins, newest first. */
export function toSpinColumns(wheel: TvSpinWheel): TvWaitlistStake[] {
  const odds = wheel.prizes.reduce((total, prize) => total + prize.weight, 0);
  return [
    {
      id: 'wheel', stake: t('tv.spin.wheel'), detail: t('tv.spin.wheelDetail'),
      places: wheel.prizes.map((prize, index) => ({
        id: `prize-${index}`, place: String(index + 1), name: prizeLabel(prize),
        status: t('tv.spin.odds', { weight: formatNumber(prize.weight), odds: formatNumber(odds) }),
      })),
    },
    {
      id: 'spins', stake: t('tv.spin.spins'), detail: t('tv.spin.spinsDetail'),
      places: wheel.spins.map((spin, index) => ({ id: `spin-${index}`, place: '', name: spin.name ?? t('tv.spin.hiddenName'), status: prizeLabel(spin) })),
    },
  ];
}

/** The spin wheel (#150, decision 0266): the prizes and their odds beside tonight's spins, live as the floor spins. */
export function SpinMode() {
  const wheel = useTvSpinWheel();
  if (wheel.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(wheel.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  return <TvWaitlistBoard title={t('tv.spin.title')} emptyText={t('tv.spin.empty')} stakes={toSpinColumns(wheel.data)} />;
}
