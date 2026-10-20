import { formatDate, t } from '@rivr/i18n';
import { DocumentPage, DocumentTable, type DocumentDetail, type DocumentTotal, type Issuer } from '@rivr/ui';

export interface InvoiceDocumentProps {
  /** The supplier, as venue configuration stood when the invoice was issued. */
  issuer: Issuer;
  /** False at the practice venue: a practice invoice, never a tax invoice (decision 0071). */
  isTaxInvoice: boolean;
  /** `RIVR/S26/41`. */
  number: string;
  /** An ISO timestamp; dated in IST. */
  issuedAt: string;
  /** Who it is billed to, with their GSTIN when a company buys under one. */
  buyer: { name: string; gstin?: string | undefined };
  lines: readonly { description: string; amountPaise: bigint }[];
  /** Beneath the lines, each as the invoice holds it: the taxable value, each tax, the total. */
  totals: readonly DocumentTotal[];
}

function invoiceDetails({ number, issuedAt, buyer }: InvoiceDocumentProps): DocumentDetail[] {
  const details = [
    { label: t('documents.invoice.number'), value: number },
    { label: t('documents.invoice.date'), value: formatDate(new Date(issuedAt)) },
    { label: t('documents.invoice.billedTo'), value: buyer.name },
  ];
  return buyer.gstin ? [...details, { label: t('documents.invoice.buyerGstin'), value: buyer.gstin }] : details;
}

/** An invoice on an A4 page, `tokens.viewport.a4`: the supplier, the number and date, the buyer, the lines and their totals. */
export function InvoiceDocument(props: InvoiceDocumentProps) {
  const title = props.isTaxInvoice ? t('documents.invoice.taxInvoice') : t('documents.invoice.practice');
  return (
    <DocumentPage issuer={props.issuer} title={title} details={invoiceDetails(props)} note={t('documents.computerGenerated')}>
      <DocumentTable
        caption={t('documents.invoice.caption')}
        columns={[{ label: t('documents.invoice.description') }, { label: t('documents.invoice.amount'), isAmount: true }]}
        rows={props.lines.map((line) => [line.description, line.amountPaise])}
        totals={props.totals}
      />
    </DocumentPage>
  );
}
