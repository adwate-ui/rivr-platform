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

  it('keeps the words of every few bars over a span of days, and every bar for a screen reader', () => {
    const days = Array.from({ length: 90 }, (_, day) => ({ label: `Day ${String(day + 1)}`, value: day, valueText: String(day) }));
    renderIn(<BarChart label="Check-ins by day" bars={days} />);
    const wordsOf = (label: string) => screen.getByText(label, { selector: '[aria-hidden]' }).className;
    expect(wordsOf('Day 1')).not.toContain('sr-only');
    expect(wordsOf('Day 2')).toMatch(/(^| )sr-only/);
    // Every fourth from 768 px; below it, every sixteenth, six in all.
    expect(wordsOf('Day 5')).toContain('max-medium:sr-only');
    expect(wordsOf('Day 17')).not.toContain('sr-only');
    expect(days.filter((day) => !wordsOf(day.label).includes('sr-only'))).toHaveLength(6);
    // So close, no bar shows its figure; a screen reader still reads each.
    expect(screen.getByText('89', { selector: 'span' })).toHaveClass('sr-only');
    expect(screen.getAllByRole('listitem')).toHaveLength(90);
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
