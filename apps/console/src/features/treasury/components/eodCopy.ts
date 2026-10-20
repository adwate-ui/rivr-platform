import type { CloseFigure, EodClose, EodFailure } from '@rivr/db';
import { isZero } from '@rivr/domain/money';
import { formatDayTime, formatMoney, t, type MessageKey } from '@rivr/i18n';

/** One of a close's figures, as the End of day lists it: what it is, its line, and whether it is out. */
export interface FigureRow {
  readonly label: string;
  readonly text: string;
  readonly isOut: boolean;
}

/** When the shift opened and closed, and who closed it. */
export function closeLine(close: EodClose): string {
  return t('console.endOfDay.closeLine', {
    opened: formatDayTime(new Date(close.openedAt)), closed: formatDayTime(new Date(close.closedAt)), name: close.closedBy,
  });
}

function figureRow(label: MessageKey, figure: CloseFigure): FigureRow {
  return {
    label: t(label),
    text: t('console.endOfDay.figure', { counted: formatMoney(figure.counted), expected: formatMoney(figure.expected), variance: formatMoney(figure.variance) }),
    isOut: !isZero(figure.variance),
  };
}

/** The close's four figures, each counted, expected and its variance. */
export function figureRows(close: EodClose): FigureRow[] {
  return [
    figureRow('console.endOfDay.cash', close.cash),
    figureRow('console.endOfDay.chips', close.chips),
    figureRow('console.endOfDay.receipts', close.receipts),
    figureRow('console.endOfDay.markers', close.markers),
  ];
}

/** Where a close stands: clean, an anomaly waiting for its reason, or reviewed with it. */
export function closeStatus(close: EodClose): string {
  if (!close.isAnomaly) return t('console.endOfDay.clean');
  if (close.review === null) return t('console.endOfDay.anomaly');
  return t('console.endOfDay.reviewed', { name: close.review.reviewedBy, reason: close.review.reason });
}

/** Why a close or a review did not go through. */
export const EOD_FAILURE_COPY: Readonly<Record<EodFailure, MessageKey>> = {
  no_shift: 'console.endOfDayFailures.noShift',
  invalid: 'console.endOfDayFailures.invalid',
  not_allowed: 'console.endOfDayFailures.notAllowed',
  no_review: 'console.endOfDayFailures.noReview',
  unavailable: 'console.endOfDayFailures.unavailable',
};
