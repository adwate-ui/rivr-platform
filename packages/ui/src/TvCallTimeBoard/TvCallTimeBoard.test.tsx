import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvCallTimeBoard, type TvCallTimeBoardProps } from './TvCallTimeBoard.tsx';

const PROPS: TvCallTimeBoardProps = {
  title: 'Call time',
  openingsTitle: 'Seats opening',
  noOpeningsText: 'No seats opening yet.',
  emptyText: 'No one on call time.',
  openings: Array.from({ length: 5 }, (_, index) => ({
    id: String(index), where: `Table 3 · Seat ${index + 1}`, name: `Leaving ${index + 1}`, time: index === 0 ? 'Now' : `In ${index * 10} min`, isNow: index === 0,
  })),
  tables: [{
    id: 't3', name: 'Table 3', detail: 'NLH 100/200',
    rows: Array.from({ length: 5 }, (_, index) => ({ id: String(index), seat: String(index + 1), name: `Player ${index + 1}`, time: `${index + 1} min` })),
  }],
};

describe('TvCallTimeBoard', () => {
  it('shows the seats opening, the first four, and each table\'s players on call time, the first four', () => {
    renderIn(<TvCallTimeBoard {...PROPS} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Call time' })).toBeInTheDocument();
    const openings = within(screen.getByRole('region', { name: 'Seats opening' }));
    expect(openings.getAllByRole('listitem')).toHaveLength(4);
    expect(openings.getByText('Table 3 · Seat 1')).toBeInTheDocument();
    expect(openings.getByText('Now')).toBeInTheDocument();
    expect(openings.queryByText('Leaving 5')).toBeNull();
    const table = within(screen.getByRole('region', { name: 'Table 3' }));
    expect(table.getByText('NLH 100/200')).toBeInTheDocument();
    expect(table.getAllByRole('listitem')).toHaveLength(4);
    expect(table.getByText('4 min')).toBeInTheDocument();
    expect(table.queryByText('Player 5')).toBeNull();
  });

  it('shows the first four tables', () => {
    const tables = ['Table 1', 'Table 2', 'Table 3', 'Table 5', 'Private Room'].map((name) => ({ id: name, name, detail: 'NLH 100/200', rows: [] }));
    renderIn(<TvCallTimeBoard {...PROPS} tables={tables} />);
    expect(screen.getByRole('region', { name: 'Table 5' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Private Room' })).toBeNull();
  });

  it('says when nobody is leaving and nobody is on call time', () => {
    renderIn(<TvCallTimeBoard {...PROPS} openings={[]} tables={[]} />);
    expect(screen.getByText('No seats opening yet.')).toBeInTheDocument();
    expect(screen.getByText('No one on call time.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvCallTimeBoard {...PROPS} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
