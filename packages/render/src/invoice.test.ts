import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { invoiceDocumentProps, renderInvoicePdf, type StoredInvoice } from './invoice.ts';
import { renderToPng } from './render.ts';
import { allowedDifference, differenceFromBaseline, pngSize } from './test/png.ts';

const A4 = tokens.viewport.a4;

/** A corporate Academy booking (#249) at the club, as the database keeps its invoice. */
const STORED: StoredInvoice = {
  number: 'RIVR/S26/41',
  isTaxInvoice: true,
  issuedAt: '2026-11-15T13:30:00Z',
  supplier: { legalName: 'RIVR Hospitality LLP', gstin: '06AAAAA0000A1Z5', address: 'Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram 122018' },
  buyer: { name: 'Northern Gaming Private Limited', gstin: '06BBBBB1111B1Z6' },
  description: 'Poker Academy, beginners course, 22 Nov 2026',
  rateBasisPoints: 1800,
  taxablePaise: 169_492n,
  cgstPaise: 15_254n,
  sgstPaise: 15_254n,
  igstPaise: 0n,
  totalPaise: 200_000n,
};

describe('a stored invoice', () => {
  it('shows the supplier and number it was issued with, and its amounts as stored', () => {
    const props = invoiceDocumentProps(STORED);
    expect(props.issuer).toEqual({ legalName: 'RIVR Hospitality LLP', gstin: '06AAAAA0000A1Z5', address: STORED.supplier.address });
    expect(props.number).toBe('RIVR/S26/41');
    expect(props.buyer).toEqual({ name: 'Northern Gaming Private Limited', gstin: '06BBBBB1111B1Z6' });
    expect(props.totals).toEqual([
      { label: 'Taxable value', paise: 169_492n },
      { label: 'CGST at 9%', paise: 15_254n },
      { label: 'SGST at 9%', paise: 15_254n },
      { label: 'Total', paise: 200_000n },
    ]);
  });

  it('shows IGST alone for a supply to another state, and a practice invoice as no tax invoice', () => {
    const props = invoiceDocumentProps({ ...STORED, cgstPaise: 0n, sgstPaise: 0n, igstPaise: 30_508n, isTaxInvoice: false, buyer: { name: 'Meera Kapoor', gstin: null } });
    expect(props.totals.map((total) => total.label)).toEqual(['Taxable value', 'IGST at 18%', 'Total']);
    expect(props.isTaxInvoice).toBe(false);
    expect(props.buyer.gstin).toBeUndefined();
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
