import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DocumentTable } from './DocumentTable.tsx';

const STATEMENT = (
  <DocumentTable
    caption="Movements in the period"
    columns={[{ label: 'Date' }, { label: 'Description' }, { label: 'Amount', isAmount: true }, { label: 'Balance', isAmount: true }]}
    rows={[
      ['1 Nov', 'Opening balance', '', 50_000_000n],
      ['30 Nov', 'Distribution', -2_500_000n, 47_500_000n],
    ]}
    totals={[
      { label: 'Fees', paise: 15_254n },
      { label: 'Closing balance', paise: 47_500_000n },
    ]}
  />
);

describe('DocumentTable', () => {
  it('lists the rows under their columns, amounts to the right in rupees, as given', () => {
    renderIn(STATEMENT);
    const table = screen.getByRole('table', { name: 'Movements in the period' });
    expect(within(table).getByRole('columnheader', { name: 'Amount' })).toHaveClass('text-end');
    expect(within(table).getByRole('cell', { name: '−₹25,000' })).toHaveClass('text-end', 'tabular-nums');
    expect(within(table).getByRole('cell', { name: '₹5,00,000' })).toBeInTheDocument();
  });

  it('lines each column header up with its cells', () => {
    renderIn(STATEMENT);
    expect(screen.getByRole('columnheader', { name: 'Date' })).not.toHaveClass('pl-6');
    expect(screen.getByRole('cell', { name: '1 Nov' })).not.toHaveClass('pl-6');
    expect(screen.getByRole('columnheader', { name: 'Description' })).toHaveClass('pl-6');
    expect(screen.getByRole('cell', { name: 'Opening balance' })).toHaveClass('pl-6');
  });

  it('writes each total as given and sets the last one larger, beneath a rule', () => {
    renderIn(STATEMENT);
    expect(screen.getByRole('rowheader', { name: 'Fees' }).nextElementSibling).toHaveTextContent('₹152.54');
    expect(screen.getByRole('rowheader', { name: 'Fees' }).closest('tr')).not.toHaveClass('border-t');
    expect(screen.getByRole('rowheader', { name: 'Closing balance' }).closest('tr')).toHaveClass('border-t', 'text-18');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(STATEMENT);
    expect(await axeViolations(container)).toEqual([]);
  });
});
