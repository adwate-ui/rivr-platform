import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { ProgressRing } from './ProgressRing.tsx';

const arcOf = (container: HTMLElement) => container.querySelector('[data-ring-arc]');

describe('ProgressRing', () => {
  it('draws what is left as the gold arc, from the top', () => {
    const { container } = renderIn(<ProgressRing fraction={0.75}>2:15:00</ProgressRing>);
    const arc = arcOf(container);
    const full = Number(arc?.getAttribute('stroke-dasharray'));
    expect(Number(arc?.getAttribute('stroke-dashoffset'))).toBeCloseTo(full * 0.25, 5);
    expect(arc).toHaveClass('stroke-gold');
    expect(container).toHaveTextContent('2:15:00');
  });

  it('turns red in the last minutes and never draws past full or below empty', () => {
    const { container, rerender } = renderIn(<ProgressRing fraction={1.4} tone="alert">0:12:00</ProgressRing>);
    expect(arcOf(container)).toHaveClass('stroke-alert');
    expect(Number(arcOf(container)?.getAttribute('stroke-dashoffset'))).toBe(0);
    rerender(<ProgressRing fraction={-2}>0:00:00</ProgressRing>);
    const arc = arcOf(container);
    expect(Number(arc?.getAttribute('stroke-dashoffset'))).toBeCloseTo(Number(arc?.getAttribute('stroke-dasharray')), 5);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<ProgressRing fraction={0.5}>1:30:00</ProgressRing>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
