import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Heatmap } from './Heatmap.tsx';

const ROWS = [
  { name: 'Preflop', cells: [{ value: '82%', detail: '23/28', band: 'strong' as const }, { value: '44%', detail: '18/41', band: 'weak' as const }] },
  { name: 'Flop', cells: [null, { value: '50%', detail: '3/6', band: 'thin' as const }] },
];

describe('Heatmap', () => {
  it('is a table with its headers, each cell its figure over what it is of and its band in words', () => {
    renderIn(<Heatmap label="Accuracy by street and position" corner="Street" columns={['CO', 'BTN']} rows={ROWS} emptyText="None yet." />);
    const table = screen.getByRole('table', { name: 'Accuracy by street and position' });
    expect(within(table).getByRole('columnheader', { name: 'BTN' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Flop' })).toBeInTheDocument();
    const cell = within(table).getByText('18/41').closest('td');
    expect(cell?.textContent).toBe('44%18/41Weak');
    expect(within(table).getByText('Too few answers')).toBeInTheDocument();
  });

  it('names the four bands in a legend', () => {
    renderIn(<Heatmap label="Accuracy" corner="Street" columns={['CO']} rows={ROWS} emptyText="None yet." />);
    const legend = screen.getByRole('list', { name: 'Bands' });
    expect(within(legend).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Strong', 'Fair', 'Weak', 'Too few answers']);
  });

  it('says so when nothing has been answered', () => {
    renderIn(<Heatmap label="Accuracy" corner="Street" columns={['CO']} rows={[]} emptyText="None yet." />);
    expect(screen.getByText('None yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Heatmap label="Accuracy" corner="Street" columns={['CO', 'BTN']} rows={ROWS} emptyText="None yet." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
