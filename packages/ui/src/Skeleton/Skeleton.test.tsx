import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Skeleton } from './Skeleton.tsx';

describe('Skeleton', () => {
  it('says it is loading to a screen reader only, never on the screen', () => {
    renderIn(<Skeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading')).toHaveClass('sr-only');
  });

  it('draws as many rows as asked', () => {
    const { container } = renderIn(<Skeleton rows={5} />);
    expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(5);
  });

  it('stands in for a console list\'s rows or the floor\'s tiles (console v3)', () => {
    const { container, rerender } = renderIn(<Skeleton look="rows" rows={6} />);
    expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(6);
    expect(container.querySelector('[data-skeleton-row]')).toHaveClass('h-touch');
    rerender(<Skeleton look="tiles" rows={4} />);
    expect(container.querySelectorAll('[data-skeleton-row]')).toHaveLength(4);
    expect(screen.getByText('Loading')).toHaveClass('sr-only');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Skeleton />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
