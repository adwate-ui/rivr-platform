import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type SetupStake, type SetupTable } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TablesBlock } from './TablesBlock.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const STAKES: readonly SetupStake[] = [{ id: 's1', name: 'NLH 100/200', game: null, smallBlind: 10000n, bigBlind: 20000n, straddle: null }];
const table = (id: string, name: string, more: Partial<SetupTable>): SetupTable =>
  ({ id, name, stakeId: 's1', seats: 9, isOpen: false, isActive: true, seated: 0, waiting: 0, ...more });
const TABLES: readonly SetupTable[] = [
  table('t1', 'Table 1', { isOpen: true, seated: 7 }),
  table('t2', 'Table 2', { waiting: 2 }),
  table('t3', 'Table 3', {}),
  table('t5', 'Table 5', { isActive: false }),
];

/** A super admin on tables setup, and a fake API that keeps every RPC sent and answers `refusals` with their code. */
function renderTables(refusals: Record<string, string> = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: { rpc: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = url.split('/rpc/')[1];
    if (rpc === undefined) return Response.json([]);
    sent.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const code = refusals[rpc];
    return code === undefined ? new Response(null, { status: 204 }) : Response.json({ code, message: 'refused' }, { status: 400 });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TablesBlock venueId="v1" stakes={STAKES} tables={TABLES} />
    </RivrDataProvider>,
  );
  return sent;
}

const rowOf = (name: string) => {
  const row = screen.getAllByRole('row').find((one) => within(one).queryAllByRole('cell')[0]?.textContent === name);
  if (row === undefined) throw new Error(`No row for ${name}`);
  return row;
};

/** Opens a table's ⋯ and presses one of its steps. */
const pressStep = (table: string, step: string) => {
  fireEvent.click(screen.getByRole('button', { name: `More for ${table}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: step }));
};

describe('tables setup: deactivate, reactivate and delete (decision 0466)', () => {
  it('says where each table stands: seated at an open one, closed tonight, or inactive and hidden', () => {
    renderTables();
    expect(rowOf('Table 1').textContent).toContain('Open · 7 seated');
    expect(rowOf('Table 3').textContent).toContain('Closed tonight');
    expect(rowOf('Table 5').textContent).toContain('Inactive · hidden from the floor');
  });

  it('keeps Change on the row and the steps that retire a table behind its ⋯ (audit F-118)', () => {
    renderTables();
    expect(within(rowOf('Table 3')).getByRole('button', { name: 'Change table Table 3' })).toBeDefined();
    expect(within(rowOf('Table 3')).queryByRole('button', { name: /Deactivate|Delete/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 5' }));
    expect(screen.getByRole('menuitem', { name: 'Reactivate' })).toBeDefined();
  });

  it('dims Deactivate and Delete on a table in play, saying why, and sends nothing: seated first, then waiting', () => {
    const sent = renderTables();
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 1' }));
    const seated = screen.getByRole('menuitem', { name: 'Deactivate · Players seated' });
    expect(seated.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(seated);
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 2' }));
    const waiting = screen.getByRole('menuitem', { name: 'Delete · Players waiting' });
    expect(waiting.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(waiting);
    expect(screen.queryByRole('button', { name: 'Yes, delete Table 2' })).toBeNull();
    expect(sent).toEqual([]);
  });

  it('deactivates an empty table and reactivates an inactive one, saying so', async () => {
    const sent = renderTables();
    pressStep('Table 3', 'Deactivate');
    await waitFor(() => expect(screen.getByText('Table 3 deactivated. Its history stays.')).toBeDefined());
    pressStep('Table 5', 'Reactivate');
    await waitFor(() => expect(screen.getByText('Table 5 is back, closed.')).toBeDefined());
    expect(sent).toEqual([{ rpc: 'deactivate_game_table', body: { p_table_id: 't3' } }, { rpc: 'reactivate_game_table', body: { p_table_id: 't5' } }]);
  });

  it('deletes only once asked, and says the history stays', async () => {
    const sent = renderTables();
    pressStep('Table 3', 'Delete');
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete Table 3' }));
    await waitFor(() => expect(screen.getByText('Table 3 deleted. Its history stays.')).toBeDefined());
    expect(sent).toEqual([{ rpc: 'delete_game_table', body: { p_table_id: 't3' } }]);
  });

  it('says why the database refused, on its own count: someone joined the list meanwhile', async () => {
    renderTables({ delete_game_table: 'RVWTG' });
    pressStep('Table 3', 'Delete');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete Table 3' }));
    await waitFor(() => expect(screen.getByText('Players wait for Table 3. Take them off its list first.')).toBeDefined());
  });

  it('opens a table\'s own form under its row with Change, and a new one above the list', async () => {
    renderTables();
    fireEvent.click(screen.getByRole('button', { name: 'Change table Table 3' }));
    expect(screen.getByRole('heading', { name: 'Change table Table 3' })).toBeDefined();
    expect(screen.getByDisplayValue('Table 3')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'New table' }));
    expect(screen.getByRole('heading', { name: 'New table' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Change table Table 3' })).toBeNull();
  });
});
