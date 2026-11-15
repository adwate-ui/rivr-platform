import { formatNumber, t } from '@rivr/i18n';

/** What a typed number counts (redesign RD-14): the units the club's settings are in. */
export type Unit = 'minutes' | 'hours' | 'days' | 'players' | 'seconds' | 'bonus';

/** The least and the most a number may be, both allowed. */
export interface UnitRange {
  readonly min: number;
  readonly max: number;
}

/** What was typed, read: its whole number when it is one in the range, and whether it is refused (typed, yet not one). */
export interface UnitReading {
  readonly value: number | null;
  readonly isRefused: boolean;
}

/** Reads what was typed against the range: blank is no value and not refused; anything else is in the range or refused. */
export function readUnit(typed: string, { min, max }: UnitRange): UnitReading {
  if (typed === '') return { value: null, isRefused: false };
  const value = Number(typed);
  const isAllowed = /^\d+$/.test(typed) && value >= min && value <= max;
  return isAllowed ? { value, isRefused: false } : { value: null, isRefused: true };
}

/** The unit's word after what was typed: `minute` after 1, else `minutes`. */
export function unitWord(unit: Unit, typed: string): string {
  return typed === '1' ? t(`ui.console.unitInput.one.${unit}`) : t(`ui.console.unitInput.many.${unit}`);
}

/** What a refused number is told: "Between 5 and 240 minutes." */
export function rangeText(unit: Unit, { min, max }: UnitRange): string {
  return t('ui.console.unitInput.between', { min: formatNumber(min), max: formatNumber(max), unit: t(`ui.console.unitInput.many.${unit}`) });
}
