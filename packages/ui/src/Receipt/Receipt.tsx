import { formatMoney, t } from '@rivr/i18n';
import type { Issuer } from '../DocumentPage/DocumentPage.tsx';

/** One line of a receipt: an amount in paise, or words such as the table and seat. */
export interface ReceiptLine {
  label: string;
  value: string | bigint;
}

export interface ReceiptProps {
  /** The club, at the head. */
  issuer: Issuer;
  /** What happened: `Cash-out`. */
  title: string;
  /** When, as the club writes it: `Sat 13 Feb, 03:40`. */
  at: string;
  /** Set apart beneath when: a practice receipt says it is one, so it is never taken for money paid. */
  notice?: string | undefined;
  lines: readonly ReceiptLine[];
  /** The line that matters most, set large beneath a rule: `Paid to cash ₹37,020`. */
  total?: { label: string; paise: bigint } | undefined;
  /** At the foot, to find it again: `Receipt RV-0213-0418`. */
  reference: string;
}

function LineRow({ label, value }: ReceiptLine) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-end tabular-nums">{typeof value === 'bigint' ? formatMoney(value) : value}</dd>
    </div>
  );
}

/**
 * A thermal receipt, `tokens.size.receipt` (576 px) wide so each CSS pixel is one printer dot, and as tall
 * as its lines. Ink on cream with dashed ink rules: a thermal printer prints ink and leaves cream as paper,
 * where a gold hairline would vanish. Type is larger than on screen, since a dot is smaller than a pixel.
 */
export function Receipt({ issuer, title, at, notice, lines, total, reference }: ReceiptProps) {
  return (
    <article aria-label={title} className="flex w-receipt flex-col gap-6 bg-cream p-6 font-text text-24 leading-snug text-on-cream">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-semibold">{issuer.legalName}</p>
        <p>{issuer.address}</p>
        {issuer.gstin ? <p>{t('ui.paper.gstin', { gstin: issuer.gstin })}</p> : null}
      </div>
      <div className="flex flex-col items-center gap-1 border-y border-dashed border-on-cream py-4 text-center">
        <h1 className="text-36 font-semibold">{title}</h1>
        <p>{at}</p>
        {notice ? <p className="font-semibold">{notice}</p> : null}
      </div>
      <dl className="flex flex-col gap-2">
        {lines.map((line, position) => (
          <LineRow key={`${String(position)}-${line.label}`} {...line} />
        ))}
      </dl>
      {total ? (
        <dl className="border-t border-dashed border-on-cream pt-4 text-36 font-semibold">
          <LineRow label={total.label} value={total.paise} />
        </dl>
      ) : null}
      <p className="text-center">{reference}</p>
    </article>
  );
}
