import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { ProgressBar } from './ProgressBar.tsx';

const fillOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-progress-fill]');

describe('ProgressBar', () => {
  it('fills to the fraction exactly, so a hold drains smoothly', () => {
    const { container } = renderIn(<ProgressBar fraction={0.66} />);
    expect(fillOf(container)?.style.transform).toBe('scaleX(0.66)');
  });

  it('never fills past full or below empty', () => {
    const { container, rerender } = renderIn(<ProgressBar fraction={3} />);
    expect(fillOf(container)?.style.transform).toBe('scaleX(1)');
    rerender(<ProgressBar fraction={Number.NaN} />);
    expect(fillOf(container)?.style.transform).toBe('scaleX(0)');
    rerender(<ProgressBar fraction={-1} />);
    expect(fillOf(container)?.style.transform).toBe('scaleX(0)');
  });

  it('fills in cream, not gold, for a call time on the console (decision 0429)', () => {
    const { container } = renderIn(<ProgressBar fraction={0.5} tone="muted" />);
    expect(container.querySelector('[data-progress-fill]')).toHaveClass('bg-content-muted');
    expect(container.querySelector('[data-progress-fill]')).not.toHaveClass('bg-gold');
  });

  it('is 200 px wide for a hold', () => {
    const { container } = renderIn(<ProgressBar fraction={0.5} width="hold" />);
    expect(container.firstElementChild).toHaveClass('w-hold-bar');
  });
});
