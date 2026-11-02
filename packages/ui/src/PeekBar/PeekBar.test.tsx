import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { PeekBar } from './PeekBar.tsx';

describe('PeekBar', () => {
  it('opens its sheet', async () => {
    const onOpen = vi.fn();
    renderIn(<PeekBar title="All tables" aside="4 running · 2 tournaments" onOpen={onOpen} />);
    const bar = screen.getByRole('button', { name: /All tables/ });
    expect(bar).toHaveTextContent('4 running · 2 tournaments');
    await userEvent.click(bar);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<PeekBar title="All tables" aside="4 running" onOpen={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
