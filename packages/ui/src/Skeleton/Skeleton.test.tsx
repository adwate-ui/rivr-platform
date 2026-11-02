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

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Skeleton />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
