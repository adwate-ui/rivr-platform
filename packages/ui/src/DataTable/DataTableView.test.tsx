import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTableViewProvider, useTableView, type TableViewStore } from './DataTableView.tsx';
import type { ViewWire } from './tableView.ts';

const OWN = { key: 'name', direction: 'ascending' } as const;

/** A store like the address: what it keeps, and every write. */
function storeOf(kept: Record<string, ViewWire | undefined> = {}) {
  const writes: { key: string; wire: ViewWire | undefined }[] = [];
  const store: TableViewStore = { read: (key) => kept[key], write: (key, wire) => { writes.push({ key, wire }); kept[key] = wire; } };
  return { store, kept, writes };
}

const within = (store: TableViewStore) => ({ children }: { children: ReactNode }) => <DataTableViewProvider store={store}>{children}</DataTableViewProvider>;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useTableView', () => {
  it('starts from what the store keeps for the table', () => {
    const { store } = storeOf({ 't.members': { s: '-visits', f: { tier: ['c', 'Member'] } } });
    const { result } = renderHook(() => useTableView('Members', OWN), { wrapper: within(store) });
    expect(result.current[0]).toEqual({ sort: { key: 'visits', direction: 'descending' }, query: '', filters: { tier: { kind: 'choice', chosen: ['Member'] } } });
  });

  it('shows a change at once and keeps it, words typed once the typing pauses', () => {
    const { store, writes } = storeOf();
    const { result } = renderHook(() => useTableView('Members', OWN), { wrapper: within(store) });
    act(() => { result.current[1]({ sort: OWN, query: 'rav', filters: {} }, true); });
    expect(result.current[0].query).toBe('rav');
    expect(writes).toEqual([]);
    act(() => { vi.advanceTimersByTime(300); });
    expect(writes).toEqual([{ key: 't.members', wire: { q: 'rav' } }]);
  });

  it('keeps a change typed at once when flushed, as a menu closing does, and only once', () => {
    const { store, writes } = storeOf();
    const { result } = renderHook(() => useTableView('Members', OWN), { wrapper: within(store) });
    act(() => { result.current[1]({ sort: OWN, query: 'rav', filters: {} }, true); });
    act(() => { result.current[2](); });
    expect(writes).toEqual([{ key: 't.members', wire: { q: 'rav' } }]);
    act(() => { vi.advanceTimersByTime(300); });
    expect(writes).toHaveLength(1);
  });

  it('follows the store when it changes from outside, as Back does', () => {
    const { store, kept } = storeOf({ 't.members': { q: 'ravi' } });
    const { result, rerender } = renderHook(() => useTableView('Members', OWN), { wrapper: within(store) });
    act(() => { result.current[1]({ sort: OWN, query: 'meera', filters: {} }); });
    act(() => { vi.advanceTimersByTime(0); });
    // The address took the change and drew the page again; then Back.
    rerender();
    expect(result.current[0].query).toBe('meera');
    kept['t.members'] = { q: 'ravi' };
    rerender();
    expect(result.current[0].query).toBe('ravi');
  });

  it('keeps the view in the table alone without a store, and keeps nothing once the table has gone', () => {
    const { result } = renderHook(() => useTableView('Members', OWN));
    act(() => { result.current[1]({ sort: null, query: 'x', filters: {} }); });
    expect(result.current[0]).toEqual({ sort: null, query: 'x', filters: {} });
    const { store, writes } = storeOf();
    const mounted = renderHook(() => useTableView('Members', OWN), { wrapper: within(store) });
    act(() => { mounted.result.current[1]({ sort: OWN, query: 'gone', filters: {} }, true); });
    mounted.unmount();
    act(() => { vi.advanceTimersByTime(300); });
    expect(writes).toEqual([]);
  });
});
