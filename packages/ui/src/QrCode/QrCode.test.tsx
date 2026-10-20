import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { QrCode } from './QrCode.tsx';

const CODE = '6f1c2a54-9d3e-4b7a-8c11-2f0e5d6a7b8c.58931234.0a1b2c3d4e5f6a7b8c9d0e1f';

/** How many unit squares a path draws. */
function modules(path: string | null | undefined): number {
  return (path ?? '').split('M').length - 1;
}

describe('QrCode', () => {
  it('is one image, named for a screen reader, holding the value it encodes', () => {
    renderIn(<QrCode value={CODE} label="Your door code" />);
    const qr = screen.getByRole('img', { name: 'Your door code' });
    expect(qr.getAttribute('data-value')).toBe(CODE);
    expect(qr).toHaveClass('size-full', 'text-on-cream');
  });

  it('draws its modules as unit squares on a square grid, the same each time for the same value', () => {
    const { container, unmount } = renderIn(<QrCode value={CODE} label="Your door code" />);
    const [, , width, height] = (container.querySelector('svg')?.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(width).toBe(height);
    const first = container.querySelector('path')?.getAttribute('d');
    expect(modules(first)).toBeGreaterThan(100);
    unmount();
    const again = renderIn(<QrCode value={CODE} label="Your door code" />);
    expect(again.container.querySelector('path')?.getAttribute('d')).toBe(first);
  });

  it('draws another value differently', () => {
    const { container } = renderIn(<QrCode value={CODE} label="Your door code" />);
    const other = renderIn(<QrCode value={`${CODE.slice(0, -1)}0`} label="Your door code" />);
    expect(other.container.querySelector('path')?.getAttribute('d')).not.toBe(container.querySelector('path')?.getAttribute('d'));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<QrCode value={CODE} label="Your door code" />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
