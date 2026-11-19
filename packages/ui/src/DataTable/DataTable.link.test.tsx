import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemberLink, MemberLinksProvider } from '../MemberLink/MemberLink.tsx';
import { renderIn } from '../test/render.tsx';
import { DataTable } from './DataTable.tsx';
import type { DataTableColumn } from './columns.ts';

interface Bonus {
  readonly id: string;
  readonly name: string;
  readonly number: number;
}

const ROWS: readonly Bonus[] = [{ id: 'm1', name: 'Ishaan Verma', number: 7 }];
const COLUMNS: readonly DataTableColumn<Bonus>[] = [
  { key: 'member', header: 'Member', priority: 'primary', isLink: true, cell: (row) => <><MemberLink memberId={row.id}>{row.name}</MemberLink>{` · No. ${String(row.number)}`}</> },
  { key: 'number', header: 'No.', cell: (row) => String(row.number) },
];

function renderTable(onRowOpen: (row: Bonus) => void, onNavigate: (href: string) => void) {
  return renderIn(
    <MemberLinksProvider links={{ hrefOf: (id) => `/members?member=${id}`, onNavigate }}>
      <DataTable label="Bonus" rows={ROWS} columns={COLUMNS} rowKey={(row) => row.id} onRowOpen={onRowOpen} emptyText="None." />
    </MemberLinksProvider>,
  );
}

describe('DataTable with a title that is its own link', () => {
  it('puts no open button around the link, and a click on it is the link’s alone', () => {
    const onRowOpen = vi.fn();
    const onNavigate = vi.fn();
    renderTable(onRowOpen, onNavigate);
    const link = screen.getByRole('link', { name: 'Ishaan Verma' });
    expect(link.closest('button')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Ishaan Verma/ })).toBeNull();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m1');
    expect(onRowOpen).not.toHaveBeenCalled();
  });

  it('still opens the row from a click anywhere else on it', () => {
    const onRowOpen = vi.fn();
    renderTable(onRowOpen, vi.fn());
    const row = screen.getAllByRole('row').find((one) => one.textContent?.includes('Ishaan Verma'));
    if (row === undefined) throw new Error('the row is not shown');
    fireEvent.click(within(row).getByText('7'));
    expect(onRowOpen).toHaveBeenCalledWith(ROWS[0]);
  });
});
