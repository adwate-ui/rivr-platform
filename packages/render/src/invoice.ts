import { tokens } from '@rivr/tokens';
import type { StoredInvoice } from '@rivr/ui';
import { renderToPdf } from './render.ts';

export type { StoredInvoice } from '@rivr/ui';

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
  readonly sac_code: string | null;
  readonly place_of_supply: string | null;
  readonly signatory_name: string | null;
  readonly signatory_designation: string | null;
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
    sacCode: row.sac_code,
    placeOfSupply: row.place_of_supply,
    signatory: row.signatory_name === null ? null : { name: row.signatory_name, designation: row.signatory_designation ?? '' },
  };
}

/** A stored invoice as a one-page A4 PDF, drawn by `@rivr/ui`'s InvoiceDocument through the `document.invoice` template (#68). */
export function renderInvoicePdf(invoice: StoredInvoice): Promise<Buffer> {
  return renderToPdf({ template: 'document.invoice', props: { invoice }, ...tokens.viewport.a4 });
}
