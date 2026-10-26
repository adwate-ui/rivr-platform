import { documents, registerMessages } from '@rivr/i18n';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/render.tsx';
import { PartnerStatementDocument, type PartnerStatement } from './PartnerStatementDocument.tsx';

registerMessages({ documents });
afterEach(cleanup);

const STATEMENT: PartnerStatement = {
  issuer: { legalName: 'RIVR Hospitality LLP', address: 'Sector 65, Gurugram', gstin: '06AAAAA0000A1Z5' },
  holder: 'Kabir Malhotra',
  kind: 'partner',
  month: '2026-11-01',
  heldOn: '2026-11-30',
  basisPoints: 1250,
  revenue: [{ name: 'Rake', paise: 300_000n }],
  expenses: [{ name: 'Bonus issued', paise: 20_000n }],
  revenuePaise: 300_000n,
  expensePaise: 20_000n,
  netPaise: 280_000n,
  sharePaise: 35_000n,
  isProvisional: false,
};

describe('PartnerStatementDocument', () => {
  it('shows the holder, the month and the holding, revenue and expenses by account, the net and the share', () => {
    render(<PartnerStatementDocument statement={STATEMENT} />);
    expect(screen.getByRole('heading', { name: 'Partner statement' })).toBeInTheDocument();
    expect(screen.getByText('Kabir Malhotra')).toBeInTheDocument();
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getByText('12.5% on 30 Nov 2026')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Less: Bonus issued/ })).toHaveTextContent('₹200');
    expect(screen.getByRole('row', { name: /^Expenses/ })).toHaveTextContent('₹200');
    expect(screen.getByRole('row', { name: /Net result/ })).toHaveTextContent('₹2,800');
    expect(screen.getByRole('row', { name: /Share at 12.5%/ })).toHaveTextContent('₹350');
    expect(screen.queryByText('Provisional')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names an investor\'s statement, and marks one provisional until the month is stored', () => {
    render(<PartnerStatementDocument statement={{ ...STATEMENT, kind: 'investor', isProvisional: true }} />);
    expect(screen.getByRole('heading', { name: 'Investor statement' })).toBeInTheDocument();
    expect(screen.getByText(/Provisional/)).toBeInTheDocument();
  });

  it('offers Back and Save as PDF when asked, from the keyboard too', async () => {
    const onSave = vi.fn();
    const onBack = vi.fn();
    render(<PartnerStatementDocument statement={STATEMENT} onSave={onSave} onBack={onBack} />);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<PartnerStatementDocument statement={STATEMENT} onSave={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
