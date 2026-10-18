import { formatDate, formatTime, formatWeekday, t } from '@rivr/i18n';

/** When a card's moment is, in IST: `Sunday 15 Nov 2026, 19:00`. `at` is an ISO timestamp. */
export function when(at: string): string {
  const moment = new Date(at);
  return t('social.when', { weekday: formatWeekday(moment), date: formatDate(moment), time: formatTime(moment) });
}
