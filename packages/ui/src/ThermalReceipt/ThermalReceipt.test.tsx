import { documents, registerMessages } from '@rivr/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThermalReceipt } from './ThermalReceipt.tsx';

registerMessages({ documents });
afterEach(cleanup);

const RECEIPT = {
  issuer: { legalName: 'RIVR Hospitality LLP', address: 'Gurugram' },
  title: 'Buy-in',
  at: '2026-10-20T17:40:00Z',
  lines: [{ label: 'Member', value: 'Vihaan Kapoor' }],
  total: { label: 'Chips issued', paise: 500_000n },
  reference: '7F3A92C1',
};

describe('ThermalReceipt', () => {
  it('dates the receipt in IST and gives its reference', () => {
    render(<ThermalReceipt {...RECEIPT} isPractice={false} />);
    expect(screen.getByText(/23:10/)).toBeInTheDocument();
    expect(screen.getByText('Receipt 7F3A92C1')).toBeInTheDocument();
    expect(screen.queryByText(/Practice receipt/)).toBeNull();
  });

  it('says a practice receipt is one, so it is never taken for money paid', () => {
    render(<ThermalReceipt {...RECEIPT} isPractice />);
    expect(screen.getByText('Practice receipt. No money changed hands.')).toBeInTheDocument();
  });
});
