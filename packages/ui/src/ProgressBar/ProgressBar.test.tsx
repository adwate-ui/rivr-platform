import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { ProgressBar } from './ProgressBar.tsx';

const fillOf = (container: HTMLElement) => container.querySelector('[data-progress-fill]');

describe('ProgressBar', () => {
  it('fills to the nearest twentieth', () => {
    const { container } = renderIn(<ProgressBar fraction={0.66} />);
    expect(fillOf(container)).toHaveClass('w-13/20');
  });

  it('never fills past full or below empty', () => {
    const { container, rerender } = renderIn(<ProgressBar fraction={3} />);
    expect(fillOf(container)).toHaveClass('w-full');
    rerender(<ProgressBar fraction={Number.NaN} />);
    expect(fillOf(container)).toHaveClass('w-0');
  });

  it('is 200 px wide for a hold', () => {
    const { container } = renderIn(<ProgressBar fraction={0.5} width="hold" />);
    expect(container.firstElementChild).toHaveClass('w-hold-bar');
  });
});
