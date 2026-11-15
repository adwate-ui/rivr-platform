import { documents, registerMessages } from '@rivr/i18n';
import { InvoiceDocument } from '@rivr/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INVOICE, STATEMENT } from '../../test/paper.ts';
import { StatementDocument } from './StatementDocument.tsx';

registerMessages({ documents });

describe('paper templates', () => {
  it('heads a tax invoice with the supplier from venue configuration, its number and the buyer GSTIN', () => {
    const html = renderToStaticMarkup(<InvoiceDocument {...INVOICE} />);
    expect(html).toContain('Tax invoice');
    expect(html).toContain('RIVR Hospitality LLP');
    expect(html).toContain('GSTIN 06AAAAA0000A1Z5');
    expect(html).toContain('RIVR/S26/41');
    expect(html).toContain('15 Nov 2026');
    expect(html).toContain('06BBBBB1111B1Z6');
  });

  it('never calls a practice invoice a tax invoice, and leaves out a buyer GSTIN the buyer has not', () => {
    const html = renderToStaticMarkup(<InvoiceDocument invoice={{ ...INVOICE.invoice, isTaxInvoice: false, buyer: { name: 'Arjun Mehta', gstin: null } }} />);
    expect(html).toContain('Practice invoice, not a tax invoice');
    expect(html).not.toContain('>Tax invoice<');
    expect(html).not.toContain('Buyer GSTIN');
  });

  it('gives a statement its period and each movement with the balance after it, as given', () => {
    const html = renderToStaticMarkup(<StatementDocument {...STATEMENT} />);
    expect(html).toContain('1 Nov 2026 to 30 Nov 2026');
    expect(html).toContain('−₹25,000');
    expect(html).toContain('₹5,75,000');
    expect(html).toContain('Closing balance');
  });
});
