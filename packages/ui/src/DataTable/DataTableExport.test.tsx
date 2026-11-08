import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { Button } from '../Button/Button.tsx';
import { Money } from '../Money/Money.tsx';
import { Text } from '../Text/Text.tsx';
import { DataTable, type DataTableColumn } from './DataTable.tsx';
import { DataTableExportProvider, type TableExportRequest } from './DataTableExport.tsx';

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

function table() {
  return renderIn(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." />);
}

describe('DataTable export, recorded first', () => {
  function exportable(exporter: (request: TableExportRequest) => Promise<boolean>) {
    return renderIn(
      <DataTableExportProvider exporter={exporter}>
        <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." exportFilter="Search: Kapoor"
          filter={{ label: 'Find a member', text: (row: Player) => row.name }} />
      </DataTableExportProvider>,
    );
  }

  /** One small Export control, as the prototype has it, offering CSV and XLSX in its menu. */
  async function exportAs(what: string, format: 'CSV' | 'XLSX') {
    await userEvent.click(screen.getByRole('button', { name: `Export ${what}` }));
    await userEvent.click(screen.getByRole('menuitem', { name: `Export ${format}` }));
  }

  it('offers no export without an exporter above it', () => {
    table();
    expect(screen.queryByRole('button', { name: 'Export Members' })).toBeNull();
  });

  it('is one small Export control, which shows its word and offers CSV and XLSX', async () => {
    exportable(async () => true);
    const control = screen.getByRole('button', { name: 'Export Members' });
    expect(control).toHaveTextContent('Export');
    await userEvent.click(control);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Export CSV', 'Export XLSX']);
  });

  it('puts the Export control where the screen asks, such as its title row', () => {
    const slot = document.createElement('div');
    document.body.append(slot);
    renderIn(
      <DataTableExportProvider exporter={async () => true}>
        <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." exportIn={slot} />
      </DataTableExportProvider>,
    );
    expect(within(slot).getByRole('button', { name: 'Export Members' })).toBeInTheDocument();
    slot.remove();
  });

  it('records the rows as shown with every filter in force, then saves the file', async () => {
    const exporter = vi.fn(async () => true);
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    exportable(exporter);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'Kapoor');
    await exportAs('Members', 'CSV');
    expect(exporter).toHaveBeenCalledWith({ what: 'Members', filter: 'Search: Kapoor; Find a member: Kapoor', format: 'csv', rows: 1 });
    expect(created).toHaveBeenCalledOnce();
    expect(clicked).toHaveBeenCalledOnce();
    created.mockRestore();
    clicked.mockRestore();
  });

  it('exports a Money cell as rupees, a number as a number, a Text cell\'s words, and a column\'s own value', async () => {
    interface Owed { readonly id: string; readonly name: string; readonly paise: bigint; readonly visits: number }
    const owedColumns: readonly DataTableColumn<Owed>[] = [
      { key: 'name', header: 'Member', cell: (row) => <Text tone="muted">{row.name}</Text> },
      { key: 'owed', header: 'Owed', cell: (row) => <Money paise={row.paise} />, sortValue: (row) => row.paise },
      { key: 'visits', header: 'Visits', cell: (row) => `${row.visits} visits`, sortValue: (row) => row.visits },
      { key: 'card', header: 'Card', cell: (row) => <Text>{row.id}</Text>, exportValue: (row) => `RV-${row.id}` },
      { key: 'open', header: '', cell: () => <Button>Open</Button> },
    ];
    let saved: Blob | undefined;
    const created = vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => {
      saved = file instanceof Blob ? file : undefined;
      return 'blob:export';
    });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderIn(
      <DataTableExportProvider exporter={async () => true}>
        <DataTable label="Owed" columns={owedColumns} rowKey={(row) => row.id} rows={[{ id: 'c1', name: 'Naina', paise: 123_450n, visits: 3 }]} emptyText="None." />
      </DataTableExportProvider>,
    );
    await exportAs('Owed', 'CSV');
    // Read back as text, the byte-order mark is dropped; the file writer's own test checks it is there.
    expect(await saved?.text()).toBe('"Member","Owed","Visits","Card"\r\n"Naina",1234.5,3,"RV-c1"\r\n');
    created.mockRestore();
    clicked.mockRestore();
  });

  it('carries the columns only an export has after the table\'s own, never drawn in the table (the owner, 9 Nov)', async () => {
    let saved: Blob | undefined;
    const created = vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => {
      saved = file instanceof Blob ? file : undefined;
      return 'blob:export';
    });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderIn(
      <DataTableExportProvider exporter={async () => true}>
        <DataTable label="Members" columns={COLUMNS.slice(0, 1)} rowKey={(row) => row.id} rows={ROWS.slice(0, 1)} emptyText="None."
          exportColumns={[{ key: 'hours', header: 'Hours played', exportValue: (row) => row.hours }, { key: 'card', header: 'Card', exportValue: (row) => row.id }]} />
      </DataTableExportProvider>,
    );
    expect(screen.queryByText('Hours played')).toBeNull();
    await exportAs('Members', 'CSV');
    expect(await saved?.text()).toBe('"Member","Hours played","Card"\r\n"Naina Kapoor",12,"c1"\r\n');
    created.mockRestore();
    clicked.mockRestore();
  });

  it('saves nothing, and says so, when the export is not recorded', async () => {
    const created = vi.spyOn(URL, 'createObjectURL');
    exportable(async () => false);
    await exportAs('Members', 'XLSX');
    expect(await screen.findByText('Export not saved. Try again.')).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
    created.mockRestore();
  });
});
