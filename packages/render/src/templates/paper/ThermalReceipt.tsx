import { formatDate, formatTime, t } from '@rivr/i18n';
import { Receipt, type Issuer, type ReceiptLine } from '@rivr/ui';

export interface ThermalReceiptProps {
  /** The club, from venue configuration. */
  issuer: Issuer;
  /** At the practice venue: the receipt says it is a practice one. */
  isPractice: boolean;
  /** What happened, as the cage words it: `Cash-out`. */
  title: string;
  /** When, an ISO timestamp; printed in IST. */
  at: string;
  /** Amounts in paise and words, in order. */
  lines: readonly ReceiptLine[];
  /** The amount that matters most, as given. */
  total?: { label: string; paise: bigint } | undefined;
  /** The receipt's reference: `RV-0213-0418`. */
  reference: string;
}

/** A thermal receipt at printer width, `tokens.size.receipt`, as tall as its lines. */
export function ThermalReceipt({ issuer, isPractice, title, at, lines, total, reference }: ThermalReceiptProps) {
  const moment = new Date(at);
  return (
    <Receipt
      issuer={issuer}
      title={title}
      at={t('documents.at', { date: formatDate(moment), time: formatTime(moment) })}
      notice={isPractice ? t('documents.receipt.practice') : undefined}
      lines={lines}
      total={total}
      reference={t('documents.receipt.reference', { number: reference })}
    />
  );
}
