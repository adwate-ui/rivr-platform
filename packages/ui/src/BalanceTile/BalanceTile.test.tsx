import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { BalanceTile } from './BalanceTile.tsx';

describe('BalanceTile', () => {
  it('shows the figure, what it is and what it is for', () => {
    renderIn(<BalanceTile icon="star" figure="3,250" label="Points" line="Spend on rewards." />);
    expect(screen.getByText('3,250')).toBeInTheDocument();
    expect(screen.getByText('Points')).toBeInTheDocument();
    expect(screen.getByText('Spend on rewards.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('History')).not.toBeInTheDocument();
  });

  it('says it opens a history, with a chevron that turns as it opens (F-054)', () => {
    const { container, rerender } = renderIn(<BalanceTile icon="star" figure="3,250" label="Points" line="Spend on rewards." onOpen={() => undefined} aria-expanded={false} />);
    expect(screen.getByRole('button', { name: /Points/ })).toHaveTextContent('History');
    const chevron = () => container.querySelector('button > span:last-child svg path')?.getAttribute('d');
    const closed = chevron();
    rerender(<BalanceTile icon="star" figure="3,250" label="Points" line="Spend on rewards." onOpen={() => undefined} aria-expanded />);
    expect(chevron()).not.toBe(closed);
  });

  it('draws bonus chips gold, and opens its history from the keyboard, saying whether it is open', async () => {
    const onOpen = vi.fn();
    renderIn(<BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in." tone="money" onOpen={onOpen} aria-expanded={false} />);
    const tile = screen.getByRole('button', { name: /Bonus chips/ });
    expect(tile).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('1,500')).toHaveClass('text-money');
    tile.focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in." tone="money" onOpen={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
