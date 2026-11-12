import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvWaitlistBoard, tvPlacesThatFit, type TvWaitlistStake } from './TvWaitlistBoard.tsx';

const STAKES = [
  { id: 'a', stake: '₹50/100', detail: '1 table open', places: [] },
  {
    id: 'b', stake: '₹100/200', detail: '2 tables open',
    places: Array.from({ length: 7 }, (_, index) => ({ id: String(index), place: String(index + 1), name: `Player ${index + 1}`, status: index === 0 ? 'Table 3' : undefined })),
  },
];

const MORE = (hidden: number) => `+${hidden} more`;

describe('TvWaitlistBoard', () => {
  it('sets a name under what is beside it in a narrow column, and beside it in a wide one, so the name is never squeezed', () => {
    const three = [...STAKES, { id: 'c', stake: '₹200/400', detail: '1 table open', places: [] }];
    const { rerender } = renderIn(<TvWaitlistBoard title="Waitlist" stakes={three} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByText('Player 1').parentElement).toContainElement(screen.getByText('Table 3'));
    rerender(<TvWaitlistBoard title="Waitlist" stakes={STAKES} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByText('Player 1').parentElement).not.toContainElement(screen.getByText('Table 3'));
  });

  it('shows each stake with its places in order, as many as fit and how many more, and says when nobody waits (F-044)', () => {
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={STAKES} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '₹50/100' })).getByText('No one waiting.')).toBeInTheDocument();
    const busy = within(screen.getByRole('region', { name: '₹100/200' }));
    expect(busy.getAllByRole('listitem')).toHaveLength(6);
    expect(busy.getByText('+1 more')).toBeInTheDocument();
    expect(busy.getByText('Player 1')).toBeInTheDocument();
    expect(busy.getByText('Table 3')).toBeInTheDocument();
    expect(busy.queryByText('Player 7')).toBeNull();
  });

  it('draws no empty place column, so names sit under their heading (F-139)', () => {
    const { container } = renderIn(<TvWaitlistBoard title="Rewards" stakes={[{ id: 'a', stake: 'Recently redeemed', detail: 'This week', places: [{ id: '1', place: '', name: 'Neel B.', status: 'Bar upgrade' }] }]} emptyText="Nothing yet." moreText={MORE} />);
    expect(container.querySelector('li')?.children).toHaveLength(2);
  });

  it('says at its foot which page it is on and which tables have no list (F-140)', () => {
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={STAKES} emptyText="No one waiting." moreText={MORE} footer="Page 1 of 2 · Table 4: no list" />);
    expect(screen.getByText('Page 1 of 2 · Table 4: no list')).toBeInTheDocument();
  });

  it('counts the rows with a status under the name, in three columns where four of them would run over the progress bar (F-044)', () => {
    const places = Array.from({ length: 6 }, (_, index) => ({ id: String(index), place: String(index + 1), name: `Player ${index + 1}`, status: index < 4 ? 'Called to Table 2' : undefined }));
    const three = ['a', 'b', 'c'].map((id) => ({ id, stake: `Table ${id}`, detail: 'NLH 100/200', places }));
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={three} emptyText="No one waiting." moreText={MORE} footer="Page 1 of 2" />);
    const column = within(screen.getByRole('region', { name: 'Table a' }));
    expect(column.getAllByRole('listitem')).toHaveLength(3);
    expect(column.getByText('+3 more')).toBeInTheDocument();
  });

  it('leaves room for its foot line under a full column, so how many more is not drawn over it (F-044)', () => {
    const places = Array.from({ length: 7 }, (_, index) => ({ id: String(index), place: String(index + 1), name: `Player ${index + 1}`, status: index === 0 ? 'Called to Table 2' : undefined }));
    const three = ['a', 'b', 'c'].map((id) => ({ id, stake: `Table ${id}`, detail: 'NLH 100/200', places }));
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={three} emptyText="No one waiting." moreText={MORE} footer="Page 1 of 2" />);
    expect(within(screen.getByRole('region', { name: 'Table a' })).getAllByRole('listitem')).toHaveLength(4);
    expect(within(screen.getByRole('region', { name: 'Table a' })).getByText('+3 more')).toBeInTheDocument();
  });

  it('says nothing of how many more on a top-N list', () => {
    const places = Array.from({ length: 10 }, (_, index) => ({ id: String(index), place: String(index + 1), name: `Player ${index + 1}` }));
    renderIn(<TvWaitlistBoard title="RIVR League" stakes={[{ id: 'a', stake: 'This month', detail: 'November 2026', places }]} emptyText="No League points yet." />);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('steps a long name down a size, with what is beside it under it, rather than cut it (F-138)', () => {
    const places = [{ id: '1', place: '1', name: 'Venkataraghavan R.', status: 'Away' }, { id: '2', place: '2', name: 'Rohan B.', status: 'Away' }];
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={[{ id: 'a', stake: 'Table 1', detail: 'NLH 100/200', places }]} emptyText="No one waiting." moreText={MORE} />);
    const long = screen.getByText('Venkataraghavan R.');
    expect(long).toHaveClass('text-56');
    expect(long.parentElement?.children).toHaveLength(2);
    const short = screen.getByText('Rohan B.');
    expect(short).toHaveClass('text-72');
    expect(short.parentElement?.children).toHaveLength(1);
  });

  it('says so with no columns at all, rather than a title over nothing (F-136)', () => {
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={[]} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByText('No one waiting.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvWaitlistBoard title="Waitlist" stakes={STAKES} emptyText="No one waiting." moreText={MORE} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  // Decision 0581: the hours leaderboard runs one list down two columns, column one ending where it fills.
  it('counts what a column holds for a board that runs one list down its columns, a long name taking two lines', () => {
    const column = (names: readonly string[]): TvWaitlistStake => ({
      id: 'c', stake: 'All time', detail: 'Places 1 to 12', places: names.map((name, index) => ({ id: String(index), place: String(index + 1), name, status: '9h 55m' })),
    });
    const short = Array.from({ length: 12 }, (_, index) => `Player ${String(index + 1)}`);
    expect(tvPlacesThatFit(column(short), 2)).toBe(6);
    expect(tvPlacesThatFit(column(short.map((name, index) => (index === 2 ? 'Siddharth M.' : name))), 2)).toBe(5);
    expect(tvPlacesThatFit(column(short.slice(0, 4)), 2)).toBe(4);
    expect(tvPlacesThatFit(column(short), 3)).toBe(3);
  });
});
