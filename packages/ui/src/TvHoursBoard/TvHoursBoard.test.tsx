import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvHoursBoard, type TvHoursBoardProps, type TvHoursRow } from './TvHoursBoard.tsx';

const rows = (count: number): TvHoursRow[] => Array.from({ length: count }, (_, index) => ({
  id: String(index), place: String(index + 1), name: `Player ${index + 1}`, time: `${12 - index} h 5 min`,
}));

const PROPS: TvHoursBoardProps = {
  title: 'Most hours played',
  emptyText: 'No hours played yet.',
  moreText: (hidden) => `+${hidden} more`,
  lists: [{ id: 'tonight', caption: 'Tonight', rows: rows(3) }, { id: 'week', caption: 'This week', rows: rows(7) }],
};

describe('TvHoursBoard', () => {
  it('shows the lists side by side, each under its period, every place with its number, the player and the time in gold', () => {
    renderIn(<TvHoursBoard {...PROPS} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Most hours played' })).toBeInTheDocument();
    const tonight = within(screen.getByRole('region', { name: 'Tonight' }));
    expect(tonight.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['1Player 112 h 5 min', '2Player 211 h 5 min', '3Player 310 h 5 min']);
    expect(tonight.getByText('12 h 5 min')).toHaveClass('text-money');
    const week = within(screen.getByRole('region', { name: 'This week' }));
    expect(week.getAllByRole('listitem')).toHaveLength(7);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('shows the six places the stage holds of a longer list, and how many more', () => {
    renderIn(<TvHoursBoard {...PROPS} lists={[{ id: 'tonight', caption: 'Tonight', rows: rows(10) }]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('+4 more')).toBeInTheDocument();
  });

  it('says so under a period nobody has played in, and with no lists at all', () => {
    const { rerender } = renderIn(<TvHoursBoard {...PROPS} lists={[{ id: 'tonight', caption: 'Tonight', rows: [] }, { id: 'week', caption: 'This week', rows: rows(2) }]} />);
    expect(within(screen.getByRole('region', { name: 'Tonight' })).getByText('No hours played yet.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(2);
    rerender(<TvHoursBoard {...PROPS} lists={[]} />);
    expect(screen.getByText('No hours played yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvHoursBoard {...PROPS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
