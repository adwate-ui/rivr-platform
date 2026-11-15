import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { BalanceTile } from './BalanceTile.tsx';

describe('BalanceTile', () => {
  it('shows the figure, what it is and what it is for', () => {
    renderIn(<BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in." />);
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('Bonus chips')).toBeInTheDocument();
    expect(screen.getByText('Use with your buy-in.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('History')).not.toBeInTheDocument();
  });

  it('says it opens a history, with a chevron that turns as it opens (F-054)', () => {
    const { container, rerender } = renderIn(<BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in." onOpen={() => undefined} aria-expanded={false} />);
    expect(screen.getByRole('button', { name: /Bonus chips/ })).toHaveTextContent('History');
    const chevron = () => container.querySelector('button > span:last-child svg path')?.getAttribute('d');
    const closed = chevron();
    rerender(<BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in." onOpen={() => undefined} aria-expanded />);
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

  it('draws the member\'s own balance large: its name above, the figure cream in the display face, no icon and no history (redesign RD-20)', async () => {
    const { container } = renderIn(<BalanceTile look="hero" figure="14,000" label="Balance" line="Use with your buy-in. Never expires." />);
    expect(screen.getByText('14,000')).toHaveClass('font-display', 'text-content');
    const words = [...container.querySelectorAll('span')].map((part) => part.textContent);
    expect(words).toEqual(['Balance', '14,000', 'Use with your buy-in. Never expires.']);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<BalanceTile icon="chip" figure="1,500" label="Bonus chips" line="Use with your buy-in." tone="money" onOpen={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
