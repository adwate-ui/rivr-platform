import { tokens } from '@rivr/tokens';
import { describe, expect, it } from 'vitest';
import { renderInvoicePdf, storedInvoiceFromRow, type InvoiceRow } from './invoice.ts';
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
  it('is read from its row with every amount as bigint paise, as stored', () => {
    expect(STORED).toMatchObject({
      number: 'RIVR/S26/41', supplier: { gstin: '06AAAAA0000A1Z5' }, buyer: { gstin: '06BBBBB1111B1Z6' },
      taxablePaise: 169_492n, cgstPaise: 15_254n, sgstPaise: 15_254n, igstPaise: 0n, totalPaise: 200_000n,
    });
  });

  it('draws as an A4 page that matches its baseline', async () => {
    const png = await renderToPng({ template: 'document.invoice', props: { invoice: STORED }, ...A4 });
    expect(await differenceFromBaseline(png, 'document-invoice-stored')).toBeLessThanOrEqual(allowedDifference(A4.width, A4.height));
    expect(pngSize(png)).toEqual({ chunk: 'IHDR', ...A4 });
  });

  it('renders to a one-page A4 PDF with its text', async () => {
    const pdf = await renderInvoicePdf(STORED);
    expect(pdf.toString('latin1', 0, 5)).toBe('%PDF-');
    expect(pdf.toString('latin1')).toContain('/FontFile');
  });
});
