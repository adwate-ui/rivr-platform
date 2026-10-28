import type { RakeChangeFailure, RakeSetting } from '@rivr/db';
import { formatDate, formatMoney, formatNumber, formatTime, t, type MessageKey } from '@rivr/i18n';

const FAILURE_COPY: Readonly<Record<RakeChangeFailure, MessageKey>> = {
  not_allowed: 'console.rake.notAllowedAction',
  invalid: 'console.rake.refused',
  too_soon: 'console.rake.tooSoon',
  unavailable: 'console.rake.unavailable',
};

/** A rake rule as the console writes it: `5% of the pot, cap ₹6,000`. The rate is kept in basis points. */
export function ruleText(setting: RakeSetting): string {
  return t('console.rake.rule', { rate: formatNumber(setting.rateBasisPoints / 100), cap: formatMoney(setting.cap) });
}

/** When a change takes effect, as the date and the 24-hour time in IST. */
export function whenOf(setting: RakeSetting): { date: string; time: string } {
  const at = new Date(setting.effectiveFrom ?? 0);
  return { date: formatDate(at), time: formatTime(at) };
}

/** What the console says when a change or a withdrawal did not go through. */
export function rakeFailureText(failure: RakeChangeFailure): string {
  return t(FAILURE_COPY[failure]);
}
