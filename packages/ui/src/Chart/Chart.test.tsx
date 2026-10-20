import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/render.tsx';
import { Chart } from './Chart.tsx';

afterEach(cleanup);

const DAYS = ['Mon', 'Tue', 'Wed'];
const SERIES = [{ name: 'Rake', values: [42, 38, 51] }, { name: 'Drop', values: [6, 5, 7] }];

describe('Chart', () => {
  it('gives screen readers every value in a table named by its title, and hides the picture', () => {
    const { container } = render(<Chart kind="line" title="Rake this week" labelName="Day" labels={DAYS} series={SERIES} emptyText="None" />);
    const table = screen.getByRole('table', { name: 'Rake this week' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Day', 'Rake', 'Drop']);
    expect(within(table).getByRole('row', { name: 'Tue 38 5' })).toBeInTheDocument();
    expect(container.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('colours each series from the chart palette, in order, and draws six at most', () => {
    const seven = Array.from({ length: 7 }, (_, s) => ({ name: `Game ${s + 1}`, values: [s, s + 1, s + 2] }));
    const { container } = render(<Chart kind="bar" title="Players" labelName="Hour" labels={DAYS} series={seven} emptyText="None" />);
    expect([...container.querySelectorAll('svg g')].map((group) => group.getAttribute('class')))
      .toEqual(['fill-chart-1', 'fill-chart-2', 'fill-chart-3', 'fill-chart-4', 'fill-chart-5', 'fill-chart-6']);
    expect(container.querySelectorAll('rect')).toHaveLength(18);
  });

  it('draws a line through each value, writing values the way it is told, and keeps repeated labels apart', () => {
    const { container } = render(<Chart kind="line" title="Rake" labelName="Day" labels={['Mon', 'Mon', 'Tue']} series={SERIES.slice(0, 1)} emptyText="None"
      formatValue={(value) => `₹${value}`} />);
    expect(container.querySelector('polyline')).toHaveClass('stroke-chart-1');
    expect(container.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(3);
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('cell', { name: '₹51' })).toBeInTheDocument();
  });

  it('draws a negative value below the zero line, and the scale down to it', () => {
    const { container } = render(<Chart kind="bar" title="Variance" labelName="Day" labels={['Mon', 'Tue']} series={[{ name: 'Cash', values: [-20, 30] }]}
      emptyText="None" />);
    const [loss, gain] = [...container.querySelectorAll('rect')];
    expect(Number(loss?.getAttribute('y'))).toBeCloseTo(Number(gain?.getAttribute('y')) + Number(gain?.getAttribute('height')));
    expect(screen.getByText('-20', { selector: 'p, span' })).toBeInTheDocument();
  });

  it('writes no scale over values that are all zero', () => {
    render(<Chart kind="bar" title="Rake" labelName="Day" labels={DAYS} series={[{ name: 'Rake', values: [0, 0, 0] }]} emptyText="None"
      formatValue={(value) => `₹${value}`} />);
    expect(screen.queryByText('₹0', { selector: 'p, span' })).toBeNull();
  });

  it('says why there is nothing to draw, that it is loading, or what failed, retried from the keyboard', async () => {
    const { rerender } = render(<Chart kind="line" title="Rake" labelName="Day" labels={DAYS} series={[]} emptyText="No rake this week." />);
    expect(screen.getByRole('status')).toHaveTextContent('No rake this week.');
    rerender(<Chart kind="line" title="Rake" labelName="Day" status="loading" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(<Chart kind="line" title="Rake" labelName="Day" status="error" onRetry={onRetry} />);
    await userEvent.tab();
    expect(within(screen.getByRole('alert')).getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Chart kind="bar" title="Rake this week" labelName="Day" labels={DAYS} series={SERIES} emptyText="None" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
