import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { cellKey, toTierMatrix, useTierActions, useTierMatrix } from './tierMatrix.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: tier_matrix answers `rows`; every other call answers `write`, and each is kept. */
function renderTiers(rows: unknown[], write: { status?: number; body: unknown } = { body: 1 }) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = url.includes('/rpc/tier_matrix') ? { body: rows } : write;
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ matrix: useTierMatrix(VENUE), actions: useTierActions(VENUE) }), { wrapper });
  return { result, calls };
}

const ROW = {
  tier_id: 'member', tier_name: 'Member', feature_key: 'learn.library', feature_name: 'Learn library', feature_description: 'The Learn tab.',
  is_enabled: false, display_mode: 'locked', shows_as: 'locked', tiers_with_it: ['Black card'],
  next_cell_id: 'n1', next_from: '2026-10-21T00:00:00+05:30', next_is_enabled: true, next_display_mode: 'locked',
} as const;
const BLACK = { ...ROW, tier_id: 'black', tier_name: 'Black card', is_enabled: true, shows_as: 'enabled', next_cell_id: null, next_from: null, next_is_enabled: null, next_display_mode: null };

afterEach(cleanup);

describe('the tier matrix', () => {
  it('reads tiers by rank, the features, and each cell with the change scheduled for it', () => {
    const matrix = toTierMatrix([ROW, BLACK]);
    expect(matrix.tiers).toEqual([{ tierId: 'member', name: 'Member' }, { tierId: 'black', name: 'Black card' }]);
    expect(matrix.features).toEqual([{ key: 'learn.library', name: 'Learn library', description: 'The Learn tab.' }]);
    expect(matrix.cells.get(cellKey('member', 'learn.library'))).toEqual({
      isEnabled: false, displayMode: 'locked', showsAs: 'locked', tiersWithIt: ['Black card'],
      next: { cellId: 'n1', from: '2026-10-21T00:00:00+05:30', isEnabled: true, displayMode: 'locked' },
    });
    expect(matrix.cells.get(cellKey('black', 'learn.library'))?.next).toBeNull();
  });

  it('asks tier_matrix for the venue', async () => {
    const { result, calls } = renderTiers([ROW]);
    await waitFor(() => expect(result.current.matrix.data?.tiers).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ p_venue_id: VENUE });
  });

  it('saves a batch now, or from a date, and says when a date has gone', async () => {
    const { result, calls } = renderTiers([]);
    const cell = { tierId: 'member', featureKey: 'learn.library', isEnabled: false, displayMode: 'hidden' } as const;
    expect(await act(() => result.current.actions.schedule.mutateAsync({ cells: [cell], from: null }))).toEqual({ ok: true, value: 1 });
    await act(() => result.current.actions.schedule.mutateAsync({ cells: [cell], from: '2026-10-25T00:00:00+05:30' }));
    expect(calls.filter((call) => call.url.includes('/rpc/schedule_tier_cells')).map((call) => call.body)).toEqual([
      { p_venue_id: VENUE, p_cells: [{ tier_id: 'member', feature_key: 'learn.library', is_enabled: false, display_mode: 'hidden' }] },
      { p_venue_id: VENUE, p_cells: [{ tier_id: 'member', feature_key: 'learn.library', is_enabled: false, display_mode: 'hidden' }], p_effective_from: '2026-10-25T00:00:00+05:30' },
    ]);
    cleanup();
    const late = renderTiers([], { status: 400, body: { code: 'RVPST', message: 'past' } });
    expect(await act(() => late.result.current.actions.schedule.mutateAsync({ cells: [cell], from: null }))).toEqual({ ok: false, error: 'in_past' });
  });

  it('withdraws a change not yet in force, and says when it already is', async () => {
    const { result } = renderTiers([], { body: [{ id: 'n1' }] });
    expect(await act(() => result.current.actions.withdraw.mutateAsync('n1'))).toEqual({ ok: true, value: null });
    cleanup();
    const inForce = renderTiers([], { body: [] });
    expect(await act(() => inForce.result.current.actions.withdraw.mutateAsync('n1'))).toEqual({ ok: false, error: 'in_past' });
  });
});
