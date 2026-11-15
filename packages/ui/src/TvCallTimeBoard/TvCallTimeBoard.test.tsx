import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvCallTimeBoard, type TvCallTimeBoardProps, type TvCallTimeSeat } from './TvCallTimeBoard.tsx';

const seats = (count: number, name = 'Player'): TvCallTimeSeat[] => Array.from({ length: count }, (_, index) => ({
  id: String(index), where: `Table 3 · seat ${index + 1}`, name: `${name} ${index + 1}`, time: index === 0 ? 'Now' : `${index * 10} min`,
}));

const PROPS: TvCallTimeBoardProps = {
  title: 'Seats opening',
  emptyText: 'No one on call time.',
  moreText: (hidden) => `+${hidden} more`,
  seats: seats(6),
};

describe('TvCallTimeBoard', () => {
  it('lists the seats in the order given, each with where it is, the player and the time left', () => {
    renderIn(<TvCallTimeBoard {...PROPS} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Seats opening' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Table 3 · seat 1Player 1Now', 'Table 3 · seat 2Player 210 min', 'Table 3 · seat 3Player 320 min',
      'Table 3 · seat 4Player 430 min', 'Table 3 · seat 5Player 540 min', 'Table 3 · seat 6Player 650 min',
    ]);
    expect(screen.getByText('50 min')).toHaveClass('text-money');
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('shows the fourteen the stage holds, two columns of seven, and how many more', () => {
    renderIn(<TvCallTimeBoard {...PROPS} seats={seats(17)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(14);
    expect(screen.queryByText('Player 15')).toBeNull();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('keeps a long name whole, its time under it, and counts those rows taller (correction 34)', () => {
    renderIn(<TvCallTimeBoard {...PROPS} seats={seats(14, 'Venkataraghavan R.').map((seat) => ({ ...seat, time: '1 h 59 min' }))} />);
    const name = screen.getByText('Venkataraghavan R. 1');
    expect(name).toHaveClass('shrink-0', 'max-w-full');
    expect(name.parentElement).toHaveClass('flex-wrap');
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByText('+6 more')).toBeInTheDocument();
  });

  it('says when nobody is on call time', () => {
    renderIn(<TvCallTimeBoard {...PROPS} seats={[]} />);
    expect(screen.getByText('No one on call time.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvCallTimeBoard {...PROPS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
