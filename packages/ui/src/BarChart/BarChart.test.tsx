import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { BarChart, type ChartBar } from './BarChart.tsx';

const HOURS: readonly ChartBar[] = [
  { label: '21', value: 33, valueText: '33' }, { label: '22', value: 41, valueText: '41' }, { label: '23', value: 0, valueText: '0' },
];

const growOf = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-bar]')].map((bar) => Number(bar.style.flexGrow));

describe('BarChart', () => {
  it('names the chart, and draws each bar as its share of the tallest', () => {
    const { container } = renderIn(<BarChart label="Seated by hour" bars={HOURS} />);
    expect(screen.getByRole('figure', { name: 'Seated by hour' })).toBeInTheDocument();
    const [first, tallest, none] = growOf(container);
    expect(first).toBeCloseTo(33 / 41);
    expect(tallest).toBe(1);
    expect(none).toBe(0);
  });

  it('reads each bar as what it is of and its figure', () => {
    renderIn(<BarChart label="Seated by hour" bars={HOURS} />);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['21: 3321', '22: 4122', '23: 023']);
  });

  it('draws nothing tall when every bar is at nothing, or a figure is not a number', () => {
    const { container } = renderIn(<BarChart label="Orders by hour" bars={[{ label: '21', value: 0, valueText: '0' }, { label: '22', value: Number.NaN, valueText: '–' }]} />);
    expect(growOf(container)).toEqual([0, 0]);
  });

  it('names eleven of many close bars on a line under them, the first to the last, and keeps every bar for a screen reader', () => {
    const days = Array.from({ length: 90 }, (_, day) => ({ label: `Day ${String(day + 1)}`, value: day, valueText: String(day) }));
    const { container } = renderIn(<BarChart label="Check-ins by day" bars={days} />);
    const scale = [...(container.querySelector('[data-scale]')?.children ?? [])];
    // Evenly from the first day to the last, so each name stands under its bar; below 768 px, every other one of those.
    expect(scale.map((name) => name.textContent)).toEqual(['Day 1', 'Day 10', 'Day 19', 'Day 28', 'Day 37', 'Day 46', 'Day 54', 'Day 63', 'Day 72', 'Day 81', 'Day 90']);
    expect(scale.filter((name) => !name.className.includes('max-medium:sr-only')).map((name) => name.textContent)).toEqual(['Day 1', 'Day 19', 'Day 37', 'Day 54', 'Day 72', 'Day 90']);
    // So close, no bar shows its figure or its own name; a screen reader still reads each.
    expect(screen.getByText('89', { selector: 'span' })).toHaveClass('sr-only');
    expect(screen.getAllByRole('listitem')).toHaveLength(90);
    expect(screen.getAllByRole('listitem')[1]?.textContent).toBe('Day 2: 1Day 2');
  });

  it('gives the hours of a day their own names, and has no line under them', () => {
    const { container } = renderIn(<BarChart label="Seated by hour" bars={HOURS} />);
    expect(container.querySelector('[data-scale]')).toBeNull();
    expect(screen.getByText('21', { selector: '[aria-hidden]' }).className).not.toContain('sr-only');
  });

  it('shows its name alone with no bars', () => {
    renderIn(<BarChart label="Orders by hour" bars={[]} />);
    expect(screen.getByText('Orders by hour')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toEqual([]);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<BarChart label="Seated by hour" bars={HOURS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
