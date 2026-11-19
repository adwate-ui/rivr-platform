import { formatNumber, t } from '@rivr/i18n';

/** What a typed number counts (redesign RD-14): the units the club's settings are in. */
export type Unit = 'minutes' | 'hours' | 'days' | 'years' | 'players' | 'playersWaiting' | 'seconds' | 'bonus';

/** How a number is typed (#1001): a whole number, or a percentage or rupees of up to two decimals. */
export type NumberForm = 'whole' | 'percent' | 'rupees';

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
  // Digits may be grouped, as the limits show them: 1,440.
  const digits = typed.replaceAll(',', '');
  const value = Number(digits);
  const isAllowed = /^\d+$/.test(digits) && value >= min && value <= max;
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

// The characters each form takes: digits, grouped as the limits show them (10,00,000), and for a percentage or rupees a
// point and at most two decimals after it.
const TAKES: Record<NumberForm, RegExp> = { whole: /^[\d,]*$/, percent: /^[\d,]*(\.\d{0,2})?$/, rupees: /^[\d,]*(\.\d{0,2})?$/ };

/** Why a field refuses what was typed, for a character it does not take: "Whole numbers only."; nothing when it takes them all. */
export function formRefusal(typed: string, form: NumberForm): string | undefined {
  if (TAKES[form].test(typed.trim())) return undefined;
  return form === 'whole' ? t('ui.console.unitInput.wholeOnly') : t('ui.console.unitInput.twoDecimals');
}

/** Why a whole number typed is refused: a character it does not take, or outside the range; nothing when it stands or is blank. */
export function unitRefusal(typed: string, unit: Unit, range: UnitRange): string | undefined {
  return formRefusal(typed, 'whole') ?? (readUnit(typed, range).isRefused ? rangeText(unit, range) : undefined);
}
