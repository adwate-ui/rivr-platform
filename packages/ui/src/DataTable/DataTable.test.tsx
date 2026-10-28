import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { Button } from '../Button/Button.tsx';
import { Money } from '../Money/Money.tsx';
import { Text } from '../Text/Text.tsx';
import { DataTable, VIRTUAL_FROM, type DataTableColumn } from './DataTable.tsx';
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

  describe('export, recorded first', () => {
    function exportable(exporter: (request: TableExportRequest) => Promise<boolean>) {
      return renderIn(
        <DataTableExportProvider exporter={exporter}>
          <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="No members yet." exportFilter="Search: Kapoor"
            filter={{ label: 'Find a member', text: (row: Player) => row.name }} />
        </DataTableExportProvider>,
      );
    }

    it('offers no export without an exporter above it', () => {
      table();
      expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    });

    it('records the rows as shown with every filter in force, then saves the file', async () => {
      const exporter = vi.fn(async () => true);
      const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export');
      const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      exportable(exporter);
      await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'Kapoor');
      await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
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
      await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
      // Read back as text, the byte-order mark is dropped; the file writer's own test checks it is there.
      expect(await saved?.text()).toBe('"Member","Owed","Visits","Card"\r\n"Naina",1234.5,3,"RV-c1"\r\n');
      created.mockRestore();
      clicked.mockRestore();
    });

    it('saves nothing, and says so, when the export is not recorded', async () => {
      const created = vi.spyOn(URL, 'createObjectURL');
      exportable(async () => false);
      await userEvent.click(screen.getByRole('button', { name: 'Export XLSX' }));
      expect(await screen.findByText('The export was not recorded, so nothing was saved. Try again.')).toBeInTheDocument();
      expect(created).not.toHaveBeenCalled();
      created.mockRestore();
    });
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
