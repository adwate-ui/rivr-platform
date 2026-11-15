import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { TvWaitlistBoard, type TvWaitlistPlace, type TvWaitlistStake } from './TvWaitlistBoard.tsx';

const places = (count: number, status?: (index: number) => string | undefined): TvWaitlistPlace[] => Array.from({ length: count }, (_, index) => ({
  id: String(index), place: String(index + 1), name: `Player ${index + 1}`, status: status?.(index),
}));

const table = (name: string, waiting: readonly TvWaitlistPlace[]): TvWaitlistStake => ({ id: name, stake: name, detail: 'NLH 100/200', places: waiting });

const MORE = (hidden: number) => `+${hidden} more`;

describe('TvWaitlistBoard', () => {
  it('shows each table as a column: its name, its stake under it, and its places in order', () => {
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', places(2)), table('Private Room', places(6))]} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Waitlist' })).toBeInTheDocument();
    const first = within(screen.getByRole('region', { name: 'Table 1' }));
    expect(first.getByRole('heading', { level: 2, name: 'Table 1' })).toBeInTheDocument();
    expect(first.getByText('NLH 100/200')).toHaveClass('uppercase', 'tracking-tv');
    expect(first.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['1Player 1', '2Player 2']);
    expect(within(screen.getByRole('region', { name: 'Private Room' })).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('shows the six places a column holds of a longer list, and how many more', () => {
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', places(8))]} emptyText="No one waiting." moreText={MORE} />);
    const column = within(screen.getByRole('region', { name: 'Table 1' }));
    expect(column.getAllByRole('listitem')).toHaveLength(6);
    expect(column.queryByText('Player 7')).toBeNull();
    expect(column.getByText('+2 more')).toBeInTheDocument();
  });

  it('wraps more than four tables to a second row, each column with what its half of the stage holds', () => {
    const five = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5'].map((name) => table(name, places(4)));
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={five} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getAllByRole('region')).toHaveLength(5);
    const column = within(screen.getByRole('region', { name: 'Table 5' }));
    expect(column.getAllByRole('listitem')).toHaveLength(2);
    expect(column.getByText('+2 more')).toBeInTheDocument();
  });

  it('shows eight tables at most, and under them the page the app passes, leaving room for it', () => {
    const nine = Array.from({ length: 9 }, (_, index) => table(`Table ${index + 1}`, places(1)));
    const { rerender } = renderIn(<TvWaitlistBoard title="Waitlist" stakes={nine} emptyText="No one waiting." moreText={MORE} footer="Page 1 of 2" />);
    expect(screen.getAllByRole('region')).toHaveLength(8);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    rerender(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', places(7))]} emptyText="No one waiting." moreText={MORE} footer="Page 2 of 2" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('sets a status under the name, in gold, and counts those rows taller', () => {
    const called = places(6, (index) => (index < 4 ? 'Called to Table 2' : undefined));
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', called)]} emptyText="No one waiting." moreText={MORE} />);
    const status = screen.getAllByText('Called to Table 2')[0];
    expect(status).toHaveClass('text-money');
    expect(screen.getByText('Player 1').parentElement).toContainElement(status ?? null);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('steps a long name down a size rather than cut it, and shows a member who hid their name as their place alone', () => {
    const waiting = [{ id: '1', place: '1', name: 'Venkataraghavan R.' }, { id: '2', place: '2', name: 'Rohan B.' }, { id: '3', place: '3', name: '' }];
    renderIn(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', waiting)]} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByText('Venkataraghavan R.')).toHaveClass('text-36');
    expect(screen.getByText('Rohan B.')).toHaveClass('text-48');
    expect(screen.getAllByRole('listitem')[2]?.textContent?.trim()).toBe('3');
  });

  it('says so with no columns at all, and in a column nobody waits in', () => {
    const { rerender } = renderIn(<TvWaitlistBoard title="Waitlist" stakes={[]} emptyText="No one waiting." moreText={MORE} />);
    expect(screen.getByText('No one waiting.')).toBeInTheDocument();
    expect(screen.queryByRole('region')).toBeNull();
    rerender(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', [])]} emptyText="No one waiting." moreText={MORE} />);
    expect(within(screen.getByRole('region', { name: 'Table 1' })).getByText('No one waiting.')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderIn(<TvWaitlistBoard title="Waitlist" stakes={[table('Table 1', places(3)), table('Table 2', [])]} emptyText="No one waiting." moreText={MORE} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
