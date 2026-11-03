import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DataTable, VIRTUAL_FROM, type DataTableColumn } from './DataTable.tsx';

interface Player {
  readonly id: string;
  readonly name: string;
  readonly hours: number;
}

const COLUMNS: readonly DataTableColumn<Player>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'hours', header: 'Hours', cell: (row) => row.hours, sortValue: (row) => row.hours, align: 'end' },
  { key: 'id', header: 'Card', cell: (row) => row.id },
];
const ROWS: readonly Player[] = [
  { id: 'c1', name: 'Naina Kapoor', hours: 12 },
  { id: 'c2', name: 'Arjun Mehta', hours: 30 },
  { id: 'c3', name: 'Kabir Sethi', hours: 4 },
];

function table(rows: readonly Player[] = ROWS, extra: { filter?: boolean } = {}) {
  return renderIn(
    <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={rows} emptyText="No members yet."
      {...(extra.filter ? { filter: { label: 'Find a member', text: (row: Player) => row.name } } : {})} />,
  );
}

/** The member names as the body rows show them, top to bottom. */
function names(): string[] {
  return screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '');
}

describe('DataTable', () => {
  it('is a table named by its label, with a header row and a row per record', () => {
    table();
    expect(screen.getByRole('table', { name: 'Members' })).toHaveAttribute('aria-rowcount', '4');
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Member', 'Hours', 'Card']);
    expect(names()).toEqual(['Naina Kapoor', 'Arjun Mehta', 'Kabir Sethi']);
  });

  it('sorts by a column, then the other way, and says which way', async () => {
    table();
    await userEvent.click(screen.getByRole('button', { name: 'Hours' }));
    expect(names()).toEqual(['Kabir Sethi', 'Naina Kapoor', 'Arjun Mehta']);
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: 'Hours' }));
    expect(names()).toEqual(['Arjun Mehta', 'Naina Kapoor', 'Kabir Sethi']);
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'none');
  });

  it('gives a wide column two shares of the width from 768 px, its header and its cells alike (A-13)', () => {
    const wide = COLUMNS.map((column) => (column.key === 'name' ? { ...column, isWide: true } : column));
    renderIn(<DataTable label="Members" columns={wide} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." />);
    expect(screen.getByRole('columnheader', { name: 'Member' })).toHaveClass('medium:col-span-2');
    expect(screen.getAllByRole('cell').filter((cell) => cell.className.includes('medium:col-span-2'))).toHaveLength(ROWS.length);
    expect(screen.getByRole('columnheader', { name: 'Hours' })).not.toHaveClass('medium:col-span-2');
  });

  it('keeps a column without a sort value as a plain header', () => {
    table();
    expect(screen.queryByRole('button', { name: 'Card' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')[2]).not.toHaveAttribute('aria-sort');
  });

  it('sorts from the keyboard', async () => {
    table();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Member' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(names()).toEqual(['Arjun Mehta', 'Kabir Sethi', 'Naina Kapoor']);
  });

  it('filters as you type, case aside, and says when nothing matches', async () => {
    table(ROWS, { filter: true });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'KAP');
    expect(names()).toEqual(['Naina Kapoor']);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'x');
    expect(screen.getByText('Nothing matches KAPx.')).toBeInTheDocument();
  });

  it('shows the empty, loading and error states', async () => {
    const { rerender } = table([]);
    expect(screen.getByText('No members yet.')).toBeInTheDocument();
    rerender(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} status="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    const onRetry = vi.fn();
    rerender(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} status="error" onRetry={onRetry} />);
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it(`draws only the rows in view past ${VIRTUAL_FROM} rows`, () => {
    const many = Array.from({ length: 10_000 }, (_, index) => ({ id: `c${index}`, name: `Member ${index}`, hours: index }));
    table(many);
    expect(screen.getByRole('table', { name: 'Members' })).toHaveAttribute('aria-rowcount', '10001');
    expect(screen.getAllByRole('row').length).toBeLessThan(40);
    expect(names()[0]).toBe('Member 0');
  });

  it('lets a long name wrap in a table that is no long list, and cuts it to one line with its words as a title in one (F5-05)', () => {
    const longName = 'Naina Kapoor, who has a much longer name than any member has';
    const { unmount } = table([{ id: 'c1', name: longName, hours: 12 }]);
    const short = screen.getAllByRole('cell')[0];
    expect(short).not.toHaveClass('truncate');
    expect(short).not.toHaveAttribute('title');
    unmount();
    table(Array.from({ length: VIRTUAL_FROM + 1 }, (_, index) => ({ id: `c${index}`, name: index === 0 ? longName : `Member ${index}`, hours: index })));
    const cut = screen.getAllByRole('cell')[0];
    expect(cut).toHaveClass('truncate');
    expect(cut).toHaveAttribute('title', longName);
  });

  it(`draws every row up to ${VIRTUAL_FROM}`, () => {
    table(Array.from({ length: VIRTUAL_FROM }, (_, index) => ({ id: `c${index}`, name: `Member ${index}`, hours: index })));
    expect(screen.getAllByRole('row')).toHaveLength(VIRTUAL_FROM + 1);
  });

  it('hands the toolbar the rows as shown, filtered and sorted', async () => {
    const toolbar = vi.fn(() => null);
    renderIn(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet."
      filter={{ label: 'Find a member', text: (row: Player) => row.name }} initialSort={{ key: 'hours', direction: 'descending' }} toolbar={toolbar} />);
    expect(toolbar).toHaveBeenLastCalledWith([ROWS[1], ROWS[0], ROWS[2]]);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'kap');
    expect(toolbar).toHaveBeenLastCalledWith([ROWS[0]]);
  });

  it('announces when nothing matches', async () => {
    table(ROWS, { filter: true });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'zz');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing matches zz.');
  });

  it('lets the body of a long table take focus, so the keys scroll it', () => {
    table(Array.from({ length: VIRTUAL_FROM + 1 }, (_, index) => ({ id: `c${index}`, name: `Member ${index}`, hours: index })));
    expect(screen.getAllByRole('rowgroup')[1]).toHaveAttribute('tabindex', '0');
  });

  it('has no accessibility violations', async () => {
    const { container, rerender } = table(ROWS, { filter: true });
    expect(await axeViolations(container)).toEqual([]);
    rerender(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} status="loading" />);
    expect(await axeViolations(container)).toEqual([]);
    rerender(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} status="error" onRetry={() => undefined} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('names each column in its cells for a phone, where rows are cards, and leaves optional columns out there', () => {
    type Row = { id: string; name: string; seat: number; note: string };
    const rows: Row[] = [{ id: 'r1', name: 'Arjun Mehta', seat: 4, note: 'Regular' }];
    renderIn(
      <DataTable<Row> label="Players" rowKey={(row) => row.id} rows={rows} emptyText="None"
        columns={[
          { key: 'name', header: 'Player', cell: (row) => row.name },
          { key: 'seat', header: 'Seat', cell: (row) => String(row.seat), align: 'end' },
          { key: 'note', header: 'Note', cell: (row) => row.note, priority: 'optional' },
        ]} />,
    );
    const [name, seat, note] = screen.getAllByRole('cell');
    expect(name).not.toHaveAttribute('data-label');
    expect(seat).toHaveAttribute('data-label', 'Seat');
    expect(note).toHaveClass('hidden', 'medium:block');
  });

  it('sorts on a phone from a bar above the cards, where the header row is hidden, and draws no bar at a desk', async () => {
    const desk = table();
    expect(screen.queryByRole('group', { name: 'Sort Members' })).toBeNull();
    desk.unmount();
    // Below 768 px.
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener: () => undefined, removeEventListener: () => undefined }));
    try {
      table();
      const bar = screen.getByRole('group', { name: 'Sort Members' });
      await userEvent.click(within(bar).getByRole('button', { name: 'Sort by Hours' }));
      expect(within(bar).getByRole('button', { name: 'Sorted by Hours, ascending' })).toHaveAttribute('aria-pressed', 'true');
      expect(names()).toEqual(['Kabir Sethi', 'Naina Kapoor', 'Arjun Mehta']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('opens a row from its title when rows open', async () => {
    type Row = { id: string; name: string };
    const onRowOpen = vi.fn();
    renderIn(
      <DataTable<Row> label="Members" rowKey={(row) => row.id} rows={[{ id: 'm1', name: 'Arjun Mehta' }]} emptyText="None"
        columns={[{ key: 'name', header: 'Member', cell: (row) => row.name }]} onRowOpen={onRowOpen} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Arjun Mehta' }));
    expect(onRowOpen).toHaveBeenCalledWith({ id: 'm1', name: 'Arjun Mehta' });
  });
});
