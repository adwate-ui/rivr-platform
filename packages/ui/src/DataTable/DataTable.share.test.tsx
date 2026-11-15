import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderIn } from '../test/render.tsx';
import { DataTable, type DataTableColumn } from './DataTable.tsx';

interface Row { readonly id: string; readonly name: string; readonly number: number }
const ROWS: readonly Row[] = [{ id: 'a', name: 'Asha Verma', number: 7 }];
const columns = (share: number | undefined): readonly DataTableColumn<Row>[] => [
  { key: 'name', header: 'Name', isWide: true, cell: (row) => row.name },
  { key: 'number', header: 'No.', cell: (row) => String(row.number), ...(share === undefined ? {} : { share }) },
];

describe('a column’s own share of the width', () => {
  it('sets every column by its share once one says its own: a wide one two, and it spans nothing', () => {
    renderIn(<DataTable label="Members" columns={columns(0.7)} rows={ROWS} rowKey={(row) => row.id} emptyText="None." />);
    const [header, body] = screen.getAllByRole('row');
    expect(header?.style.gridTemplateColumns).toBe('minmax(0, 2fr) minmax(0, 0.7fr)');
    expect(body?.style.gridTemplateColumns).toBe('minmax(0, 2fr) minmax(0, 0.7fr)');
    expect(screen.getByRole('columnheader', { name: /^Name/ }).className).not.toContain('col-span-2');
  });

  it('leaves a table with no such share to equal shares, a wide column spanning two', () => {
    renderIn(<DataTable label="Members" columns={columns(undefined)} rows={ROWS} rowKey={(row) => row.id} emptyText="None." />);
    expect(screen.getAllByRole('row')[0]?.style.gridTemplateColumns).toBe('');
    expect(screen.getByRole('columnheader', { name: /^Name/ }).className).toContain('col-span-2');
  });
});
