import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { MarqueeBlock } from './MarqueeBlock.tsx';

describe('MarqueeBlock', () => {
  it('runs the phrases in a line, a suit between each pair, hidden from screen readers', () => {
    const { container } = renderIn(<MarqueeBlock phrases={['Play', 'Connect', 'Belong']} />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<MarqueeBlock phrases={['Play', 'Connect', 'Belong']} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
