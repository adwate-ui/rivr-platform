import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DataTable, type DataTableColumn, type DataTableRequest, type DataTableServer } from './DataTable.tsx';
import { DataTableViewProvider, type TableViewStore } from './DataTableView.tsx';
import { Pages, pagesShown } from './Pages.tsx';
import type { ViewWire } from './tableView.ts';

interface Member {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly visits: number;
}

// As the server counts them, over every member: far more than the two rows loaded.
const TIERS = [{ value: 'Black card', count: 312 }, { value: 'Member', count: 4500 }];
const COLUMNS: readonly DataTableColumn<Member>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name, filter: 'text' },
  { key: 'tier', header: 'Tier', cell: (row) => row.tier, filter: 'choice', choices: TIERS },
  { key: 'visits', header: 'Visits', cell: (row) => row.visits, sortValue: (row) => row.visits, filter: 'number', align: 'end' },
];
// A page as the server gave it: in neither the table's order nor any filter's, and drawn as it is.
const PAGE: readonly Member[] = [
  { id: 'm2', name: 'Vihaan Kapoor', tier: 'Member', visits: 3 },
  { id: 'm1', name: 'Arjun Mehta', tier: 'Black card', visits: 40 },
];
const SORT = { key: 'name', direction: 'ascending' } as const;
const FIRST: DataTableRequest = { sort: SORT, query: '', filters: {}, page: 1 };

interface Drawn {
  readonly rows?: readonly Member[];
  readonly total?: number;
  readonly kept?: Record<string, ViewWire | undefined>;
  readonly columns?: readonly DataTableColumn<Member>[];
}

/** The Members table in server mode, 25 to a page, beneath a store like the address; gives every request handed over. */
function members({ rows = PAGE, total = 4812, kept = {}, columns = COLUMNS }: Drawn = {}) {
  const onRequest = vi.fn<DataTableServer['onRequest']>();
  const store: TableViewStore = { read: (key) => kept[key], write: (key, wire) => { kept[key] = wire; } };
  const drawn = renderIn(
    <DataTableViewProvider store={store}>
      <DataTable label="Members" columns={columns} rowKey={(row) => row.id} rows={rows} emptyText="No members yet." initialSort={SORT}
        filter={{ label: 'Find a member', text: (row) => row.name }} server={{ total, pageSize: 25, onRequest }} />
    </DataTableViewProvider>,
  );
  return { onRequest, kept, ...drawn };
}

const namesShown = () => within(screen.getByRole('table', { name: 'Members' })).queryAllByRole('row').slice(1)
  .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
const pages = () => screen.getByRole('navigation', { name: 'Members: pages' });

describe('DataTable in server mode (redesign RD-13)', () => {
  it('hands its view to the screen when first drawn, and draws the rows given as they are', async () => {
    const { onRequest, container } = members({ kept: { 't.members': { f: { tier: ['c', 'Member'] } } } });
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith({ ...FIRST, filters: { tier: { kind: 'choice', chosen: ['Member'] } } }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    // Neither sorted by name nor cut to the tier chosen: that is the screen's to do.
    expect(namesShown()).toEqual(['Vihaan Kapoor', 'Arjun Mehta']);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('hands over an order, a filter and words typed, the words once typing pauses', async () => {
    const { onRequest } = members();
    await waitFor(() => expect(onRequest).toHaveBeenLastCalledWith(FIRST));
    await userEvent.click(screen.getByRole('button', { name: 'Visits' }));
    await waitFor(() => expect(onRequest).toHaveBeenLastCalledWith({ ...FIRST, sort: { key: 'visits', direction: 'ascending' } }));
    onRequest.mockClear();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'kap');
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith(expect.objectContaining({ query: 'kap' })));
    // Not at each key: `k` and `ka` were never asked for.
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(namesShown()).toEqual(['Vihaan Kapoor', 'Arjun Mehta']);
  });

  it('counts a choice as the screen passes it, and leaves a choice with none passed nothing counted from the page', async () => {
    members();
    await userEvent.click(screen.getByRole('button', { name: 'Tier: sort and filter' }));
    const tier = screen.getByRole('dialog', { name: 'Tier: sort and filter' });
    expect(within(tier).getAllByRole('button').map((chip) => chip.textContent)).toEqual(['Black card312', 'Member4,500']);
    await userEvent.keyboard('{Escape}');
    cleanup();
    members({ columns: COLUMNS.map(({ choices: _choices, ...column }) => column) });
    await userEvent.click(screen.getByRole('button', { name: 'Tier: sort and filter' }));
    expect(within(screen.getByRole('dialog', { name: 'Tier: sort and filter' })).queryAllByRole('button')).toEqual([]);
  });

  it('says how many rows show of all, and offers Clear all only while a filter is on', async () => {
    const { onRequest } = members();
    expect(screen.getByRole('status')).toHaveTextContent('2 of 4,812');
    // An order alone is no filter (redesign correction 5).
    await userEvent.click(screen.getByRole('button', { name: 'Visits' }));
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tier: sort and filter' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Member/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Remove filter Tier: Member' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
    await waitFor(() => expect(onRequest).toHaveBeenLastCalledWith({ ...FIRST, sort: { key: 'visits', direction: 'ascending' } }));
  });

  it('puts the pages in its foot, hands over the page pressed, keeps it in the address, and starts again from the first on a change', async () => {
    const { onRequest, kept } = members();
    expect(within(pages()).getAllByRole('button').map((page) => page.textContent)).toEqual(['1', '2', '3', '193']);
    expect(within(pages()).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(pages()).getByRole('button', { name: 'Page 3' }));
    await waitFor(() => expect(onRequest).toHaveBeenLastCalledWith({ ...FIRST, page: 3 }));
    expect(kept['t.members']).toEqual({ p: 3 });
    expect(within(pages()).getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: 'Member' }));
    await waitFor(() => expect(onRequest).toHaveBeenLastCalledWith({ ...FIRST, sort: { key: 'name', direction: 'descending' } }));
    expect(kept['t.members']).toEqual({ s: '-name' });
  });

  it('shows no pages for a single page, and asks for the last page when the one asked for is past it', async () => {
    members({ total: 25 });
    expect(screen.queryByRole('navigation')).toBeNull();
    cleanup();
    const { onRequest } = members({ rows: [], total: 60, kept: { 't.members': { p: 99 } } });
    await waitFor(() => expect(onRequest).toHaveBeenLastCalledWith({ ...FIRST, page: 3 }));
  });

  it('keeps its header when the screen finds nothing for the filters, and says there are none when there are none at all', () => {
    members({ rows: [], total: 0, kept: { 't.members': { q: 'zz' } } });
    expect(screen.getByRole('columnheader', { name: /^Tier/ })).toBeInTheDocument();
    expect(screen.getByText('Nothing matches zz.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    cleanup();
    members({ rows: [], total: 0 });
    expect(screen.getByText('No members yet.')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader')).toBeNull();
    // Nothing shows of nothing: no count either.
    expect(screen.queryByText('0 of 0')).toBeNull();
  });
});

describe("a table's pages", () => {
  it('offers the first, the last and the page shown with its neighbours, a gap where two or more are left out', () => {
    expect(pagesShown(1, 193)).toEqual([1, 2, 3, 'gap', 193]);
    expect(pagesShown(50, 193)).toEqual([1, 'gap', 49, 50, 51, 'gap', 193]);
    expect(pagesShown(193, 193)).toEqual([1, 'gap', 191, 192, 193]);
    // One page left out is shown, not a gap.
    expect(pagesShown(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pagesShown(2, 2)).toEqual([1, 2]);
    expect(pagesShown(1, 1)).toEqual([1]);
  });

  it('names each page, marks the one shown and tells the page pressed', async () => {
    const onPage = vi.fn();
    const { container } = renderIn(<Pages label="Members" page={50} count={193} onPage={onPage} />);
    expect(screen.getByRole('button', { name: 'Page 50' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 49' })).not.toHaveAttribute('aria-current');
    await userEvent.click(screen.getByRole('button', { name: 'Page 193' }));
    expect(onPage).toHaveBeenCalledWith(193);
    expect(await axeViolations(container)).toEqual([]);
  });
});
