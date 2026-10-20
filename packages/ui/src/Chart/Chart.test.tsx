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
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('colours each series from the chart palette, in order', () => {
    const { container } = render(<Chart kind="bar" title="Rake" labelName="Day" labels={DAYS} series={SERIES} emptyText="None" />);
    expect([...container.querySelectorAll('svg g')].map((group) => group.getAttribute('class'))).toEqual(['fill-chart-1', 'fill-chart-2']);
    expect(container.querySelectorAll('rect')).toHaveLength(6);
  });

  it('draws a line through each value, writing values the way it is told', () => {
    const { container } = render(<Chart kind="line" title="Rake" labelName="Day" labels={DAYS} series={SERIES.slice(0, 1)} emptyText="None"
      formatValue={(value) => `₹${value}`} />);
    expect(container.querySelector('polyline')).toHaveClass('stroke-chart-1');
    expect(container.querySelectorAll('circle')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: '₹51' })).toBeInTheDocument();
  });

  it('says why there is nothing to draw, that it is loading, or what failed with a retry', async () => {
    const { rerender } = render(<Chart kind="line" title="Rake" labelName="Day" labels={DAYS} series={[]} emptyText="No rake this week." />);
    expect(screen.getByRole('status')).toHaveTextContent('No rake this week.');
    rerender(<Chart kind="line" title="Rake" labelName="Day" status="loading" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(<Chart kind="line" title="Rake" labelName="Day" status="error" onRetry={onRetry} />);
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Chart kind="bar" title="Rake this week" labelName="Day" labels={DAYS} series={SERIES} emptyText="None" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
