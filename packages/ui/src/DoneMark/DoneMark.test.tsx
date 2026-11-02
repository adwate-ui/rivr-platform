import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { DoneMark } from './DoneMark.tsx';

describe('DoneMark', () => {
  it('is a gold circle with a tick, hidden from screen readers', () => {
    const { container } = renderIn(<DoneMark />);
    const mark = container.firstElementChild;
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveClass('bg-gold', 'rounded-full', 'size-tile');
    expect(mark?.querySelector('svg')).not.toBeNull();
  });
});
