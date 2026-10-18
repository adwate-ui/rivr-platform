import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Spacer } from './Spacer.tsx';

describe('Spacer', () => {
  it('takes all remaining space and is hidden from assistive technology', () => {
    const { container } = renderIn(<Spacer />);
    const spacer = container.firstElementChild;
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
    expect(spacer).toHaveClass('flex-1');
  });

  it('holds a fixed step of the spacing scale', () => {
    const { container } = renderIn(<Spacer size={6} />);
    expect(container.firstElementChild).toHaveClass('size-6', 'shrink-0');
  });
});
