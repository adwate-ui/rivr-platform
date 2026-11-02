import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Figure } from './Figure.tsx';

describe('Figure', () => {
  it('is a timer read out by its label while the digits tick', () => {
    renderIn(<Figure size="timer" role="timer" aria-label="Call time left 2h 41m">2:41:08</Figure>);
    const timer = screen.getByRole('timer', { name: 'Call time left 2h 41m' });
    expect(timer).toHaveTextContent('2:41:08');
    expect(timer).toHaveClass('font-display', 'text-48', 'tabular-nums');
  });

  it('sets a waitlist place at 160 px', () => {
    renderIn(<Figure size="place">1</Figure>);
    expect(screen.getByText('1')).toHaveClass('text-160');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<Figure size="hold" role="timer" aria-label="Held for 19 min">19:42</Figure>);
    expect(await axeViolations(container)).toEqual([]);
  });
});
