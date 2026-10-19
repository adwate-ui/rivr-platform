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
});
