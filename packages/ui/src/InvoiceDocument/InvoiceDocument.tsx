import { formatDate, formatNumber, t } from '@rivr/i18n';
import { Button } from '../Button/Button.tsx';
import { DocumentPage, type DocumentDetail } from '../DocumentPage/DocumentPage.tsx';
import { DocumentTable, type DocumentTotal } from '../DocumentTable/DocumentTable.tsx';

/**
 * An invoice as the database keeps it (#23, #379, #380): everything as it stood when it was issued, the
 * supplier's legal name, GSTIN and address from venue configuration, and the number in the venue's series,
 * which carries its prefix (`RIVR/S26/41`). Amounts are the stored paise; nothing is worked out again here.
 */
export interface StoredInvoice {
  readonly number: string;
  /** False at the practice venue: a practice invoice, never a tax invoice. */
  readonly isTaxInvoice: boolean;
  readonly issuedAt: string;
  readonly supplier: { readonly legalName: string; readonly gstin: string | null; readonly address: string };
  readonly buyer: { readonly name: string; readonly gstin: string | null };
  readonly description: string;
  /** The GST rate in basis points: 1800 is 18%. */
  readonly rateBasisPoints: number;
  readonly taxablePaise: bigint;
  readonly cgstPaise: bigint;
  readonly sgstPaise: bigint;
  /** Above zero only for a supply to another state (#380), when CGST and SGST are zero. */
  readonly igstPaise: bigint;
  readonly totalPaise: bigint;
}

export interface InvoiceDocumentProps {
  invoice: StoredInvoice;
  /** Offers Save as PDF above the page (the browser's own print), left off the page itself (#249). */
  onSave?: () => void;
}

/** A rate in basis points as the invoice prints it: 900 is `9%`, 250 is `2.5%`. */
const rate = (basisPoints: number): string => `${formatNumber(basisPoints / 100)}%`;

/** Beneath the line: the taxable value, CGST and SGST at half the rate each or IGST alone, and the total. */
function totalsOf(invoice: StoredInvoice): DocumentTotal[] {
  const tax = invoice.igstPaise > 0n
    ? [{ label: t('documents.invoice.igst', { rate: rate(invoice.rateBasisPoints) }), paise: invoice.igstPaise }]
    : [
        { label: t('documents.invoice.cgst', { rate: rate(invoice.rateBasisPoints / 2) }), paise: invoice.cgstPaise },
        { label: t('documents.invoice.sgst', { rate: rate(invoice.rateBasisPoints / 2) }), paise: invoice.sgstPaise },
      ];
  return [
    { label: t('documents.invoice.taxableValue'), paise: invoice.taxablePaise },
    ...tax,
    { label: t('documents.invoice.total'), paise: invoice.totalPaise },
  ];
}

function detailsOf(invoice: StoredInvoice): DocumentDetail[] {
  const details = [
    { label: t('documents.invoice.number'), value: invoice.number },
    { label: t('documents.invoice.date'), value: formatDate(new Date(invoice.issuedAt)) },
    { label: t('documents.invoice.billedTo'), value: invoice.buyer.name },
  ];
  return invoice.buyer.gstin ? [...details, { label: t('documents.invoice.buyerGstin'), value: invoice.buyer.gstin }] : details;
}

/**
 * A stored invoice on an A4 page, `tokens.viewport.a4` (#68, #249): the supplier, the number and date, the buyer,
 * the line and its totals exactly as stored. @rivr/render draws it to PDF; the player app shows it and the member
 * saves it as a PDF. Its copy is the `documents` namespace, which the caller registers.
 */
export function InvoiceDocument({ invoice, onSave }: InvoiceDocumentProps) {
  const title = invoice.isTaxInvoice ? t('documents.invoice.taxInvoice') : t('documents.invoice.practice');
  const issuer = { legalName: invoice.supplier.legalName, address: invoice.supplier.address, gstin: invoice.supplier.gstin ?? undefined };
  return (
    <div className="flex flex-col gap-4">
      {onSave ? <div className="print:hidden"><Button onClick={onSave}>{t('documents.invoice.save')}</Button></div> : null}
      <DocumentPage issuer={issuer} title={title} details={detailsOf(invoice)} note={t('documents.computerGenerated')}>
        <DocumentTable
          caption={t('documents.invoice.caption')}
          columns={[{ label: t('documents.invoice.description') }, { label: t('documents.invoice.amount'), isAmount: true }]}
          rows={[[invoice.description, invoice.taxablePaise]]}
          totals={totalsOf(invoice)}
        />
      </DocumentPage>
    </div>
  );
}
