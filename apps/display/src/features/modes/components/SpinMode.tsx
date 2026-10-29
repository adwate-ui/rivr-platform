import { useTvSpinWheel, type SpinPrizeKind, type TvSpinWheel } from '@rivr/db/spin';
import { fromPaise } from '@rivr/domain/money';
import { formatChips, formatNumber, t } from '@rivr/i18n';
import { Text, TV_WAITLIST_PLACES_SHOWN, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';
import { usePage } from './usePage.ts';

/** A prize as the TV names it: `100 points`, `500 bonus chips` (no rupee, #628) or `Nothing`. */
function prizeLabel(prize: { readonly kind: SpinPrizeKind; readonly amount: bigint }): string {
  if (prize.kind === 'points') return t('tv.spin.points', { points: formatNumber(prize.amount) });
  if (prize.kind === 'bonus') return t('tv.spin.bonus', { chips: formatChips(fromPaise(prize.amount)) });
  return t('tv.spin.nothing');
}

/**
 * The wheel as the board's two columns: its prizes in order with their odds, and tonight's spins, newest first. A wheel of
 * more prizes than a column shows (#582) shows them a page at a time, from `first`, the column saying which.
 */
export function toSpinColumns(wheel: TvSpinWheel, first = 0): TvWaitlistStake[] {
  const odds = wheel.prizes.reduce((total, prize) => total + prize.weight, 0);
  const shown = wheel.prizes.slice(first, first + TV_WAITLIST_PLACES_SHOWN);
  const isPaged = wheel.prizes.length > TV_WAITLIST_PLACES_SHOWN;
  return [
    {
      id: 'wheel', stake: t('tv.spin.wheel'),
      detail: isPaged ? t('tv.spin.page', { from: first + 1, to: first + shown.length, count: wheel.prizes.length }) : t('tv.spin.wheelDetail'),
      places: shown.map((prize, index) => ({
        id: `prize-${first + index}`, place: String(first + index + 1), name: prizeLabel(prize),
        status: t('tv.spin.odds', { weight: formatNumber(prize.weight), odds: formatNumber(odds) }),
      })),
    },
    {
      id: 'spins', stake: t('tv.spin.spins'), detail: t('tv.spin.spinsDetail'),
      places: wheel.spins.map((spin, index) => ({ id: `spin-${index}`, place: '', name: spin.name ?? t('tv.spin.hiddenName'), status: prizeLabel(spin) })),
    },
  ];
}

/** The spin wheel (#150, decision 0266): the prizes and their odds beside tonight's spins, live as the floor spins; a long wheel a page at a time (#582). */
export function SpinMode() {
  const wheel = useTvSpinWheel();
  const first = usePage(Math.ceil((wheel.data?.prizes.length ?? 0) / TV_WAITLIST_PLACES_SHOWN)) * TV_WAITLIST_PLACES_SHOWN;
  if (wheel.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(wheel.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  return <TvWaitlistBoard title={t('tv.spin.title')} emptyText={t('tv.spin.empty')} stakes={toSpinColumns(wheel.data, first)} />;
}
