import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvHighHandBoard, type TvHighHandBoardProps } from './TvHighHandBoard.tsx';

const BOARD: TvHighHandBoardProps = {
  handsTitle: 'Hit one, get paid',
  hands: [{ id: 'royal_flush', name: 'Royal flush', bonus: '25,000' }, { id: 'four_of_a_kind', name: 'Four of a kind', bonus: '5,000' }],
  rules: 'Both hole cards must play · Shown at showdown · 4 or more players dealt in',
  payoutsTitle: 'Paid tonight',
  payouts: [
    { id: 'h2', name: 'Devansh M.', detail: 'Four Jacks · Table 2 · 02:43', bonus: '5,000', isNew: true },
    { id: 'h1', name: 'Siddharth V.', detail: 'Four Nines · Table 3 · 01:12', bonus: '5,000' },
  ],
  emptyText: 'None yet tonight.',
};

describe('TvHighHandBoard', () => {
  it('lists the hands with their Bonus, and the rules under them', () => {
    renderIn(<TvHighHandBoard {...BOARD} />);
    const hands = within(screen.getByRole('region', { name: 'Hit one, get paid' }));
    expect(hands.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Royal flush25,000', 'Four of a kind5,000']);
    expect(hands.getByText('Both hole cards must play · Shown at showdown · 4 or more players dealt in')).toBeInTheDocument();
  });

  it('lists tonight\'s payouts in the order given, the one just paid lit, and never cuts a name short', () => {
    renderIn(<TvHighHandBoard {...BOARD} />);
    const rows = within(screen.getByRole('region', { name: 'Paid tonight' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual(['Devansh M.Four Jacks · Table 2 · 02:435,000', 'Siddharth V.Four Nines · Table 3 · 01:125,000']);
    expect(rows[0]).toHaveClass('bg-subtle');
    expect(rows[1]).not.toHaveClass('bg-subtle');
    expect(screen.getByText('Devansh M.')).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('Four Jacks · Table 2 · 02:43')).toHaveClass('truncate');
  });

  it('shows the newest six payouts, and says so when there is none yet', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({ id: `h${String(index)}`, name: `Player ${String(index)}`, detail: 'Royal flush · Table 1 · 21:00', bonus: '25,000' }));
    const { unmount } = renderIn(<TvHighHandBoard {...BOARD} payouts={many} />);
    expect(within(screen.getByRole('region', { name: 'Paid tonight' })).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByText('Player 6')).not.toBeInTheDocument();
    unmount();
    renderIn(<TvHighHandBoard {...BOARD} payouts={[]} />);
    expect(screen.getByText('None yet tonight.')).toBeInTheDocument();
  });

  it('draws no title of its own: the stage has it', () => {
    renderIn(<TvHighHandBoard {...BOARD} />);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvHighHandBoard {...BOARD} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
