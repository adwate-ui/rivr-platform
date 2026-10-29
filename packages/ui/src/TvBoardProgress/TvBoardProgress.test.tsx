import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvBoardProgress } from './TvBoardProgress.tsx';

describe('TvBoardProgress', () => {
  it('fills over the board’s time, along the foot of the stage, and screen readers skip it', () => {
    const { container } = renderIn(<TvBoardProgress durationMs={30_000} />);
    const track = container.firstElementChild;
    expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(track).toHaveClass('absolute', 'bottom-0', 'bg-hairline');
    const bar = container.querySelector('[data-board-progress]');
    expect(bar).toHaveClass('origin-left', 'bg-accent');
    expect(bar).toHaveStyle({ animationDuration: '30000ms' });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvBoardProgress durationMs={30_000} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
