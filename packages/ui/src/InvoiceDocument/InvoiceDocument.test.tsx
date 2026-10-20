import { documents, registerMessages } from '@rivr/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/render.tsx';
import { InvoiceDocument, type StoredInvoice } from './InvoiceDocument.tsx';

registerMessages({ documents });
afterEach(cleanup);

const STORED: StoredInvoice = {
  number: 'RIVR/S26/41',
  isTaxInvoice: true,
  issuedAt: '2026-11-15T13:30:00Z',
  supplier: { legalName: 'RIVR Hospitality LLP', gstin: '06AAAAA0000A1Z5', address: 'Sector 65, Gurugram' },
  buyer: { name: 'Northern Gaming Private Limited', gstin: '06BBBBB1111B1Z6' },
  description: 'Poker Academy, Level 1, November',
  rateBasisPoints: 1800,
  taxablePaise: 169_492n,
  cgstPaise: 15_254n,
  sgstPaise: 15_254n,
  igstPaise: 0n,
  totalPaise: 200_000n,
};

describe('InvoiceDocument', () => {
  it('shows the supplier, number and buyer as issued, and its amounts as stored, CGST and SGST at half the rate', () => {
    render(<InvoiceDocument invoice={STORED} />);
    expect(screen.getByText('Tax invoice')).toBeInTheDocument();
    expect(screen.getByText('RIVR/S26/41')).toBeInTheDocument();
    expect(screen.getByText('06BBBBB1111B1Z6')).toBeInTheDocument();
    expect(screen.getByText('CGST at 9%')).toBeInTheDocument();
    expect(screen.getByText('SGST at 9%')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows IGST alone for another state, an odd rate exactly, and a practice invoice as no tax invoice', () => {
    render(<InvoiceDocument invoice={{ ...STORED, isTaxInvoice: false, rateBasisPoints: 500, cgstPaise: 0n, sgstPaise: 0n, igstPaise: 9_524n }} />);
    expect(screen.getByText('Practice invoice, not a tax invoice')).toBeInTheDocument();
    expect(screen.getByText('IGST at 5%')).toBeInTheDocument();
    expect(screen.queryByText(/^CGST/)).toBeNull();
  });

  it('offers Save as PDF when asked, from the keyboard too', async () => {
    const onSave = vi.fn();
    const { container } = render(<InvoiceDocument invoice={STORED} onSave={onSave} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Save as PDF' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledOnce();
    expect(await axeViolations(container)).toEqual([]);
  });
});
