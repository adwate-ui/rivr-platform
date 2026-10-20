import { t } from '@rivr/i18n';
import type { ReactNode } from 'react';

/** Who issues a receipt, invoice or statement, as venue configuration holds it. */
export interface Issuer {
  /** The legal entity: `RIVR Hospitality LLP`. */
  legalName: string;
  address: string;
  /** Printed beneath the address when the club has one. */
  gstin?: string | undefined;
}

/** One fact at the head of a document: `Invoice number`, `RIVR/S26/41`. */
export interface DocumentDetail {
  label: string;
  value: string;
}

export interface DocumentPageProps {
  /** The club, at the head beside the title. */
  issuer: Issuer;
  /** What the document is: `Tax invoice`, `Statement`. */
  title: string;
  /** Numbers, dates and parties, in two columns beneath the head. */
  details: readonly DocumentDetail[];
  /** The body: a DocumentTable. */
  children: ReactNode;
  /** One line at the foot. */
  note?: string | undefined;
}

/**
 * An A4 page, invoices and statements, drawn by @rivr/render at `tokens.viewport.a4` (794 by 1123, 96 to
 * the inch) to PDF and PNG. It fills the page it is drawn on. Printed matter is ink on cream, the colours
 * of the wordmark's tiles, so it prints on office paper without a dark page (docs/decisions/0160).
 */
export function DocumentPage({ issuer, title, details, children, note }: DocumentPageProps) {
  return (
    <article aria-label={title} className="flex min-h-dvh w-full flex-col gap-10 bg-cream p-16 font-text text-14 leading-normal text-on-cream">
      <header className="flex items-start justify-between gap-8 border-b border-on-cream pb-6">
        <div className="flex flex-col gap-1 text-16">
          <p className="font-semibold">{issuer.legalName}</p>
          <p>{issuer.address}</p>
          {issuer.gstin ? <p>{t('ui.paper.gstin', { gstin: issuer.gstin })}</p> : null}
        </div>
        <h1 className="shrink-0 font-display text-36 leading-tight">{title}</h1>
      </header>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
        {details.map((detail) => (
          <div key={detail.label} className="flex flex-col gap-1">
            <dt className="text-12 font-medium uppercase tracking-wide">{detail.label}</dt>
            <dd className="text-16">{detail.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex-1">{children}</div>
      {note ? <p className="text-12">{note}</p> : null}
    </article>
  );
}
