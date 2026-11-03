import { FEEDBACK_RATED } from '@rivr/contracts';
import type { FeedbackItem, FeedbackRatings } from '@rivr/db';
import { formatDayMonth, formatNumber, t } from '@rivr/i18n';

/** Who: `Mihir Shah · No. 1213`. */
export const whoLine = (item: FeedbackItem): string => t('console.feedback.who', { name: item.fullName, number: item.memberNumber });

/**
 * What it is and when: a rating with its visit's day; the app's detailed form with its recommendation, or its quick note
 * by topic (#637); or a note; each with the day it came.
 */
export function kindLine(item: FeedbackItem): string {
  const date = formatDayMonth(new Date(item.createdAt));
  if (item.score !== null && item.visitClosedAt !== null) {
    return t('console.feedback.ratingLine', { score: item.score, date: formatDayMonth(new Date(item.visitClosedAt)) });
  }
  if (item.nps !== null) return t('console.feedback.detailedLine', { nps: formatNumber(item.nps), date });
  if (item.topic !== null) return t('console.feedback.quickLine', { topic: t(`console.feedback.topics.${item.topic}`), date });
  return t('console.feedback.noteLine', { date });
}

/** The detailed form's four ratings in a line: `Gameplay 5 · Cashier 3 · Service 4 · Ambience 5`. */
export function ratingsLine(ratings: FeedbackRatings): string {
  return FEEDBACK_RATED.map((area) => t('console.feedback.rating', { area: t(`console.feedback.rated.${area}`), score: formatNumber(ratings[area]) }))
    .join(t('console.feedback.ratingsSeparator'));
}
