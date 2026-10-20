import { formatNumber, t } from '@rivr/i18n';
import { tokens } from '@rivr/tokens';
// The labels below are made here, in Node, so the documents' copy must be registered here too.
import './messages.ts';
import { renderToPdf } from './render.ts';
import type { InvoiceDocumentProps } from './templates/paper/InvoiceDocument.tsx';

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

/** A rate in basis points as the invoice prints it: 900 is `9%`, 250 is `2.5%`. */
const rate = (basisPoints: number): string => `${formatNumber(basisPoints / 100)}%`;

/** An `invoice` row as the database API returns it: bigint paise arrive as JSON numbers. */
export interface InvoiceRow {
  readonly number: string;
  readonly is_tax_invoice: boolean;
  readonly issued_at: string;
  readonly supplier_legal_name: string;
  readonly supplier_gstin: string | null;
  readonly supplier_address: string;
  readonly buyer_name: string;
  readonly buyer_gstin: string | null;
  readonly description: string;
  readonly rate_basis_points: number;
  readonly taxable_paise: number;
  readonly cgst_paise: number;
  readonly sgst_paise: number;
  readonly igst_paise: number;
  readonly total_paise: number;
}

/** A stored invoice from its row, each amount the row's paise as a bigint. */
export function storedInvoiceFromRow(row: InvoiceRow): StoredInvoice {
  return {
    number: row.number,
    isTaxInvoice: row.is_tax_invoice,
    issuedAt: row.issued_at,
    supplier: { legalName: row.supplier_legal_name, gstin: row.supplier_gstin, address: row.supplier_address },
    buyer: { name: row.buyer_name, gstin: row.buyer_gstin },
    description: row.description,
    rateBasisPoints: row.rate_basis_points,
    taxablePaise: BigInt(row.taxable_paise),
    cgstPaise: BigInt(row.cgst_paise),
    sgstPaise: BigInt(row.sgst_paise),
    igstPaise: BigInt(row.igst_paise),
    totalPaise: BigInt(row.total_paise),
  };
}

/** The A4 invoice template's props for a stored invoice: its lines and totals exactly as stored. */
export function invoiceDocumentProps(invoice: StoredInvoice): InvoiceDocumentProps {
  const tax = invoice.igstPaise > 0n
    ? [{ label: t('documents.invoice.igst', { rate: rate(invoice.rateBasisPoints) }), paise: invoice.igstPaise }]
    : [
        { label: t('documents.invoice.cgst', { rate: rate(invoice.rateBasisPoints / 2) }), paise: invoice.cgstPaise },
        { label: t('documents.invoice.sgst', { rate: rate(invoice.rateBasisPoints / 2) }), paise: invoice.sgstPaise },
      ];
  return {
    issuer: { legalName: invoice.supplier.legalName, address: invoice.supplier.address, gstin: invoice.supplier.gstin ?? undefined },
    isTaxInvoice: invoice.isTaxInvoice,
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    buyer: { name: invoice.buyer.name, gstin: invoice.buyer.gstin ?? undefined },
    lines: [{ description: invoice.description, amountPaise: invoice.taxablePaise }],
    totals: [
      { label: t('documents.invoice.taxableValue'), paise: invoice.taxablePaise },
      ...tax,
      { label: t('documents.invoice.total'), paise: invoice.totalPaise },
    ],
  };
}

/** A stored invoice as a one-page A4 PDF, drawn from `@rivr/ui` by the `document.invoice` template (#68). */
export function renderInvoicePdf(invoice: StoredInvoice): Promise<Buffer> {
  return renderToPdf({ template: 'document.invoice', props: invoiceDocumentProps(invoice), ...tokens.viewport.a4 });
}
