import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Text } from '../Text/Text.tsx';
import { DataTable, type DataTableColumn } from './DataTable.tsx';
import { DataTableExportProvider } from './DataTableExport.tsx';
import { DataTableViewProvider, type TableViewStore } from './DataTableView.tsx';
import type { ViewWire } from './tableView.ts';

interface Member {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly role: string;
  readonly tables: readonly string[];
  readonly visits: number;
  readonly joined: string;
}

const DAY = 24 * 3600 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// No column says its kind: each is read from its rows (owner, 9 Nov: every column filtered by its type). The tier is
// drawn in a Text, so its filter reads the cell's words; the role is read from its own value.
const COLUMNS: readonly DataTableColumn<Member>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name, priority: 'primary' },
  { key: 'tier', header: 'Tier', cell: (row) => <Text tone="muted">{row.tier}</Text> },
  { key: 'role', header: 'Role', cell: (row) => row.role.toUpperCase(), filterValue: (row) => row.role },
  // A member who moved tables is found under each table.
  { key: 'tables', header: 'Tables', cell: (row) => row.tables.join(', '), filterValue: (row) => row.tables },
  { key: 'visits', header: 'Visits', cell: (row) => row.visits.toLocaleString('en-IN'), sortValue: (row) => row.visits, align: 'end' },
  { key: 'joined', header: 'Joined', cell: (row) => row.joined.slice(0, 10), sortValue: (row) => row.joined },
];
const ROWS: readonly Member[] = [
  { id: 'm1', name: 'Naina Kapoor', tier: 'Black card', role: 'player', tables: ['Table 1', 'Table 3'], visits: 1200, joined: daysAgo(0) },
  { id: 'm2', name: 'Arjun Mehta', tier: 'Member', role: 'player', tables: ['Table 1'], visits: 3, joined: daysAgo(40) },
  { id: 'm3', name: 'Kabir Sethi', tier: 'Member', role: 'dealer', tables: [], visits: 12, joined: daysAgo(2) },
  { id: 'm4', name: 'Vihaan Kapoor', tier: "Founders' Circle", role: 'player', tables: ['Table 3'], visits: 0, joined: daysAgo(90) },
];

/** The names in the table's rows as shown: each body row's first cell. */
const namesShown = () => within(screen.getByRole('table', { name: 'Members' })).queryAllByRole('row').slice(1)
  .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

const body = <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." filter={{ label: 'Find a member', text: (row: Member) => row.name }} />;

function table(exporter?: () => Promise<boolean>) {
  return renderIn(exporter === undefined ? body : <DataTableExportProvider exporter={exporter}>{body}</DataTableExportProvider>);
}

/** Opens a column's menu from its header, giving the dialog. */
async function menuOf(column: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${column}: sort and filter`) }));
  return screen.getByRole('dialog', { name: `${column}: sort and filter` });
}

describe('DataTable column menus (owner, 9 Nov: every column filtered by its type, from its header)', () => {
  it('gives every column with a heading a menu, its filter by its kind, a choice with how many rows hold each value', async () => {
    const { container } = table();
    for (const column of ['Member', 'Tier', 'Role', 'Tables', 'Visits', 'Joined']) {
      expect(screen.getByRole('button', { name: `${column}: sort and filter` })).toHaveAttribute('aria-haspopup', 'dialog');
    }
    const tier = await menuOf('Tier');
    expect(within(within(tier).getByRole('group', { name: 'Tier' })).getAllByRole('button').map((chip) => chip.textContent))
      .toEqual(['Black card1', "Founders' Circle1", 'Member2']);
    expect(await axeViolations(container)).toEqual([]);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tier: sort and filter' })).toHaveFocus();
    expect(within(await menuOf('Member')).getByRole('searchbox', { name: 'Contains' })).toBeInTheDocument();
  });

  it('keeps rows holding every filter in force, each a pill, with how many show of all', async () => {
    table();
    const tier = await menuOf('Tier');
    await userEvent.click(within(tier).getByRole('button', { name: /^Member/ }));
    await userEvent.click(within(tier).getByRole('button', { name: /^Black card/ }));
    expect(namesShown()).toEqual(['Naina Kapoor', 'Arjun Mehta', 'Kabir Sethi']);
    await userEvent.click(within(await menuOf('Role')).getByRole('button', { name: /^dealer/ }));
    expect(namesShown()).toEqual(['Kabir Sethi']);
    expect(screen.getByRole('button', { name: 'Tier: sort and filter, filtered' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Role: dealer' }));
    expect(namesShown()).toEqual(['Naina Kapoor', 'Arjun Mehta', 'Kabir Sethi']);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'zz');
    expect(screen.getByText('Nothing matches zz.')).toBeInTheDocument();
    // The header stays, with every column's menu, though no row is left (owner, 9 Nov).
    expect(screen.getByRole('columnheader', { name: /^Tier/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tier: sort and filter, filtered' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(namesShown()).toHaveLength(4);
    expect(screen.getByRole('searchbox', { name: 'Find a member' })).toHaveValue('');
  });

  it('finds a row under each of its values: a member at two tables under both, each table counting them', async () => {
    table();
    const tables = within(await menuOf('Tables')).getByRole('group', { name: 'Tables' });
    expect(within(tables).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Table 12', 'Table 32']);
    await userEvent.click(within(tables).getByRole('button', { name: /^Table 3/ }));
    expect(namesShown()).toEqual(['Naina Kapoor', 'Vihaan Kapoor']);
  });

  it('keeps a figure from and to, and days by a preset, and sorts from the menu', async () => {
    table();
    const visits = await menuOf('Visits');
    await userEvent.type(within(visits).getByRole('textbox', { name: 'From' }), '1,000');
    expect(namesShown()).toEqual(['Naina Kapoor']);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Visits: at least 1,000' }));
    await userEvent.click(within(await menuOf('Joined')).getByRole('radio', { name: 'Last 7 days' }));
    expect(namesShown()).toEqual(['Naina Kapoor', 'Kabir Sethi']);
    expect(screen.getByRole('button', { name: 'Remove filter Joined: Last 7 days' })).toBeInTheDocument();
    const member = await menuOf('Member');
    await userEvent.click(within(member).getByRole('button', { name: 'Sort descending' }));
    expect(namesShown()).toEqual(['Naina Kapoor', 'Kabir Sethi']);
    await userEvent.click(within(member).getByRole('button', { name: 'Sort ascending' }));
    expect(namesShown()).toEqual(['Kabir Sethi', 'Naina Kapoor']);
    expect(within(member).getByRole('button', { name: 'Sort ascending' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the focus in reach: in the menu after Clear, on the column after its pill goes, on the trigger past the last control', async () => {
    table();
    const tier = await menuOf('Tier');
    await userEvent.click(within(tier).getByRole('button', { name: /^Member/ }));
    await userEvent.click(within(tier).getByRole('button', { name: 'Clear' }));
    expect(tier).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Tier: sort and filter' })).toHaveFocus();
    const role = await menuOf('Role');
    await userEvent.click(within(role).getByRole('button', { name: /^dealer/ }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Role: dealer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Role: sort and filter' })).toHaveFocus());
    const visits = await menuOf('Visits');
    within(visits).getByRole('textbox', { name: 'To' }).focus();
    await userEvent.tab();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Visits: sort and filter' })).toHaveFocus();
  });

  it('keeps a filter typed at once when a row is opened straight after', async () => {
    const kept: Record<string, ViewWire | undefined> = {};
    const store: TableViewStore = { read: (key) => kept[key], write: (key, wire) => { kept[key] = wire; } };
    const onRowOpen = vi.fn();
    renderIn(<DataTableViewProvider store={store}><DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="None." onRowOpen={onRowOpen} /></DataTableViewProvider>);
    await userEvent.type(within(await menuOf('Visits')).getByRole('textbox', { name: 'From' }), '10');
    await userEvent.click(screen.getByRole('button', { name: 'Naina Kapoor' }));
    expect(onRowOpen).toHaveBeenCalled();
    expect(kept['t.members']).toEqual({ f: { visits: ['r', '10', ''] } });
  });

  it('records the filters in force with an export', async () => {
    const exporter = vi.fn(async () => true);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    table(exporter);
    await userEvent.click(within(await menuOf('Tier')).getByRole('button', { name: /^Member/ }));
    await userEvent.type(within(await menuOf('Member')).getByRole('searchbox', { name: 'Contains' }), 'sethi');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Export Members' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(exporter).toHaveBeenCalledWith({ what: 'Members', filter: 'Member: sethi; Tier: Member', format: 'csv', rows: 1 });
    vi.restoreAllMocks();
  });

  it('keeps its view in the store a DataTableViewProvider gives, and shows the view the store holds', async () => {
    const kept: Record<string, ViewWire | undefined> = { 't.members': { f: { role: ['c', 'dealer'] } } };
    const store: TableViewStore = { read: (key) => kept[key], write: (key, wire) => { kept[key] = wire; } };
    renderIn(<DataTableViewProvider store={store}>{body}</DataTableViewProvider>);
    expect(namesShown()).toEqual(['Kabir Sethi']);
    expect(screen.getByRole('button', { name: 'Remove filter Role: dealer' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter Role: dealer' }));
    await act(async () => { await new Promise((done) => { setTimeout(done, 0); }); });
    expect(kept['t.members']).toBeUndefined();
  });
});
