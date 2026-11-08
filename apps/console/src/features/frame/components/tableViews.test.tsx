import { DataTable, DataTableViewProvider, type DataTableColumn } from '@rivr/ui';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAddressTableViews, useNavigateKeepingViews } from './tableViews.ts';

afterEach(cleanup);

interface Member {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
}

const COLUMNS: readonly DataTableColumn<Member>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'tier', header: 'Tier', cell: (row) => row.tier, sortValue: (row) => row.tier },
];
const ROWS: readonly Member[] = [
  { id: 'm1', name: 'Naina Kapoor', tier: 'Member' },
  { id: 'm2', name: 'Arjun Mehta', tier: 'Member' },
  { id: 'm3', name: '9000 Club', tier: 'Black card' },
];

/** Members as the console holds it: the table in the address, and a row opening its record by a link of the screen's own. */
function Members() {
  const views = useAddressTableViews();
  const open = useNavigateKeepingViews(['q']);
  return (
    <DataTableViewProvider store={views}>
      <DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="None."
        filter={{ label: 'Find a member', text: (row) => row.name }} onRowOpen={(row) => open(`/members?member=${row.id}`)} />
    </DataTableViewProvider>
  );
}

function renderAt(entry: string): AnyRouter {
  const router = createRouter({ routeTree: createRootRoute({ component: Members }), history: createMemoryHistory({ initialEntries: [entry] }) });
  render(<RouterProvider router={router} />);
  return router;
}

const names = () => within(screen.getByRole('table', { name: 'Members' })).getAllByRole('row').slice(1)
  .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('table views in the address (owner, 9 Nov)', () => {
  it('keeps a table filtered in the address, other keys kept, the entry replaced rather than added to Back', async () => {
    const router = renderAt('/members?q=kept');
    fireEvent.click(await screen.findByRole('button', { name: 'Tier: sort and filter' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Tier: sort and filter' })).getByRole('button', { name: /^Black card/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'kept', 't.members': { f: { tier: ['c', 'Black card'] } } }));
    expect(router.history.length).toBe(1);
    expect(names()).toEqual(['9000 Club']);
  });

  it('keeps figures typed as words, once the typing pauses', async () => {
    const router = renderAt('/members');
    fireEvent.change(await screen.findByRole('searchbox', { name: 'Find a member' }), { target: { value: '9000' } });
    expect(names()).toEqual(['9000 Club']);
    await waitFor(() => expect(Reflect.get(router.state.location.search, 't.members')).toEqual({ q: '9000' }));
  });

  it('keeps the list as it was filtered when a row opens its record', async () => {
    const router = renderAt('/members?q=kept&t.members=%7B%22s%22%3A%22-name%22%7D');
    expect(await screen.findByRole('table', { name: 'Members' })).toBeDefined();
    expect(names()).toEqual(['Naina Kapoor', 'Arjun Mehta', '9000 Club']);
    fireEvent.click(screen.getByRole('button', { name: 'Arjun Mehta' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'kept', 't.members': { s: '-name' }, member: 'm2' }));
  });
});
