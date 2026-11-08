import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Text } from '../Text/Text.tsx';
import { DataTable, type DataTableColumn } from './DataTable.tsx';
import { DataTableExportProvider } from './DataTableExport.tsx';

interface Member {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly role: string;
}

// The tier is drawn in a Text, so its filter reads the cell's words; the role is read from its own value.
const COLUMNS: readonly DataTableColumn<Member>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, filter: 'text' },
  { key: 'tier', header: 'Tier', cell: (row) => <Text tone="muted">{row.tier}</Text>, filter: 'choice' },
  { key: 'role', header: 'Role', cell: (row) => row.role.toUpperCase(), filter: 'choice', filterValue: (row) => row.role },
];
const ROWS: readonly Member[] = [
  { id: 'm1', name: 'Naina Kapoor', tier: 'Black card', role: 'player' },
  { id: 'm2', name: 'Arjun Mehta', tier: 'Member', role: 'player' },
  { id: 'm3', name: 'Kabir Sethi', tier: 'Member', role: 'dealer' },
  { id: 'm4', name: 'Vihaan Kapoor', tier: "Founders' Circle", role: 'player' },
];

/** The names in the table's rows as shown: each body row's first cell. */
const namesShown = () => within(screen.getByRole('table', { name: 'Members' })).queryAllByRole('row').slice(1)
  .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

function table(exporter?: () => Promise<boolean>) {
  const body = <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." />;
  return renderIn(exporter === undefined ? body : <DataTableExportProvider exporter={exporter}>{body}</DataTableExportProvider>);
}

describe('DataTable column filters (owner, 8 Nov: filters on every table)', () => {
  it('opens Filters below the bar: a box for each words column and chips for each choice column, with how many rows hold each value', async () => {
    const { container } = table();
    const open = screen.getByRole('button', { name: 'Filters' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Filters' }).id).toBe(open.getAttribute('aria-controls'));
    expect(screen.getByRole('searchbox', { name: 'Member' })).toBeInTheDocument();
    const tiers = screen.getByRole('group', { name: 'Tier' });
    expect(within(tiers).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Black card1', "Founders' Circle1", 'Member2']);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('keeps rows holding any value picked in a column, and every column in force', async () => {
    table();
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Tier' })).getByRole('button', { name: /^Member/ }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Tier' })).getByRole('button', { name: /^Black card/ }));
    expect(namesShown()).toEqual(['Naina Kapoor', 'Arjun Mehta', 'Kabir Sethi']);
    await userEvent.click(within(screen.getByRole('group', { name: 'Role' })).getByRole('button', { name: /^dealer/ }));
    expect(namesShown()).toEqual(['Kabir Sethi']);
    expect(screen.getByRole('button', { name: 'Filters, 2 in force' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Member' }), 'kapoor');
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(namesShown()).toHaveLength(4);
  });

  it('records the column filters in force with an export', async () => {
    const exporter = vi.fn(async () => true);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    table(exporter);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(within(screen.getByRole('group', { name: 'Tier' })).getByRole('button', { name: /^Member/ }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Member' }), 'sethi');
    await userEvent.click(screen.getByRole('button', { name: 'Export Members' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(exporter).toHaveBeenCalledWith({ what: 'Members', filter: 'Member: sethi; Tier: Member', format: 'csv', rows: 1 });
    vi.restoreAllMocks();
  });
});
