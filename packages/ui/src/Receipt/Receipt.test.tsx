import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Receipt } from './Receipt.tsx';

const CASH_OUT = {
  issuer: { legalName: 'RIVR Hospitality LLP', address: 'Upper floor, Glaza, Gurugram', gstin: '06AAAAA0000A1Z5' },
  title: 'Cash-out',
  at: 'Sat 13 Feb, 03:40',
  lines: [
    { label: 'Stake', value: '100/200' },
    { label: 'Buy-in', value: 2_000_000n },
  ],
  total: { label: 'Paid to cash', paise: 4_650_000n },
  reference: 'Receipt RV-0213-0418',
} as const;

describe('Receipt', () => {
  it('heads with the club, its address and GSTIN, then what happened and when', () => {
    renderIn(<Receipt {...CASH_OUT} />);
    expect(screen.getByText('RIVR Hospitality LLP')).toBeInTheDocument();
    expect(screen.getByText('GSTIN 06AAAAA0000A1Z5')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Cash-out' })).toBeInTheDocument();
    expect(screen.getByText('Sat 13 Feb, 03:40')).toBeInTheDocument();
  });

  it('writes amounts in rupees with Indian grouping and words as they are', () => {
    renderIn(<Receipt {...CASH_OUT} />);
    expect(screen.getByText('Buy-in').nextElementSibling).toHaveTextContent('₹20,000');
    expect(screen.getByText('Stake').nextElementSibling).toHaveTextContent('100/200');
  });

  it('sets the total apart, and ends with the reference', () => {
    renderIn(<Receipt {...CASH_OUT} />);
    const total = screen.getByText('Paid to cash').closest('dl');
    expect(total).toHaveClass('border-t', 'text-36');
    expect(within(total ?? document.body).getByText('₹46,500')).toBeInTheDocument();
    expect(screen.getByRole('article').lastElementChild).toHaveTextContent('Receipt RV-0213-0418');
  });

  it('is printer width, ink on cream, and prints no GSTIN line for a club without one', () => {
    renderIn(<Receipt {...CASH_OUT} issuer={{ legalName: 'RIVR Hospitality LLP', address: 'Gurugram' }} total={undefined} />);
    expect(screen.getByRole('article', { name: 'Cash-out' })).toHaveClass('w-receipt', 'bg-cream', 'text-on-cream');
    expect(screen.queryByText(/GSTIN/)).toBeNull();
    expect(screen.queryByText('Paid to cash')).toBeNull();
  });

  it('sets a notice apart beneath when, such as a practice receipt saying it is one', () => {
    renderIn(<Receipt {...CASH_OUT} notice="Practice receipt. No money changed hands." />);
    expect(screen.getByText('Sat 13 Feb, 03:40').nextElementSibling).toHaveTextContent('Practice receipt. No money changed hands.');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Receipt {...CASH_OUT} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
