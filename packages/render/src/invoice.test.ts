import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { invoiceDocumentProps, renderInvoicePdf, storedInvoiceFromRow, type InvoiceRow } from './invoice.ts';
import { renderToPng } from './render.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

const A4 = tokens.viewport.a4;

/** A corporate Academy booking (#249) at the club, as the database API returns its invoice. */
const ROW: InvoiceRow = {
  number: 'RIVR/S26/41',
  is_tax_invoice: true,
  issued_at: '2026-11-15T13:30:00Z',
  supplier_legal_name: 'RIVR Hospitality LLP',
  supplier_gstin: '06AAAAA0000A1Z5',
  supplier_address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018',
  buyer_name: 'Northern Gaming Private Limited',
  buyer_gstin: '06BBBBB1111B1Z6',
  description: 'Poker Academy, beginners course, 22 Nov 2026',
  rate_basis_points: 1800,
  taxable_paise: 169_492,
  cgst_paise: 15_254,
  sgst_paise: 15_254,
  igst_paise: 0,
  total_paise: 200_000,
};
const STORED = storedInvoiceFromRow(ROW);

describe('a stored invoice', () => {
  it('shows the supplier and number it was issued with, and its amounts as stored', () => {
    const props = invoiceDocumentProps(STORED);
    expect(STORED.totalPaise).toBe(200_000n);
    expect(props.issuer).toEqual({ legalName: 'RIVR Hospitality LLP', gstin: '06AAAAA0000A1Z5', address: ROW.supplier_address });
    expect(props.number).toBe('RIVR/S26/41');
    expect(props.buyer).toEqual({ name: 'Northern Gaming Private Limited', gstin: '06BBBBB1111B1Z6' });
    expect(props.totals).toEqual([
      { label: 'Taxable value', paise: 169_492n },
      { label: 'CGST at 9%', paise: 15_254n },
      { label: 'SGST at 9%', paise: 15_254n },
      { label: 'Total', paise: 200_000n },
    ]);
  });

  it('shows IGST alone for a company in another state', () => {
    const props = invoiceDocumentProps(storedInvoiceFromRow({ ...ROW, buyer_gstin: '29CCCCC2222C1Z7', cgst_paise: 0, sgst_paise: 0, igst_paise: 30_508 }));
    expect(props.totals.map((total) => total.label)).toEqual(['Taxable value', 'IGST at 18%', 'Total']);
  });

  it('prints a practice invoice as no tax invoice, with no supplier GSTIN, and an odd rate exactly', () => {
    const props = invoiceDocumentProps(storedInvoiceFromRow({ ...ROW, is_tax_invoice: false, supplier_gstin: null, buyer_gstin: null, rate_basis_points: 500 }));
    expect(props.isTaxInvoice).toBe(false);
    expect(props.issuer.gstin).toBeUndefined();
    expect(props.buyer.gstin).toBeUndefined();
    expect(props.totals.map((total) => total.label)).toEqual(['Taxable value', 'CGST at 2.5%', 'SGST at 2.5%', 'Total']);
  });

  it('draws as an A4 page that matches its baseline', async () => {
    const png = await renderToPng({ template: 'document.invoice', props: invoiceDocumentProps(STORED), ...A4 });
    expect(await differenceFromBaseline(png, 'document-invoice-stored')).toBeLessThanOrEqual(allowedDifference(A4.width, A4.height));
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', ...A4 });
  });

  it('renders to a one-page A4 PDF with its text', async () => {
    const pdf = await renderInvoicePdf(STORED);
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('/FontFile');
  });
});
