import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloorList } from './FloorList.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE: FloorTable = {
  id: 't2', venueId: 'v1', name: 'Table 2', room: 'main', seats: 9, tableTypeId: 'tt-small', tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n,
  buyIn: 500000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: 3, mustMoveToTableId: null, isOpen: true,
};
const OTHER: FloorTable = { ...TABLE, id: 't3', name: 'Table 3', tableTypeId: 'tt-big', tableTypeName: 'NLH 100/200' };

describe('FloorList', () => {
  it('names each Join by its table, and shows only the one pressed as pending (F3-17)', async () => {
    renderList([TABLE, OTHER]);
    fireEvent.click(await screen.findByRole('button', { name: 'Join Table 2' }, { timeout: 5000 }));
    expect(screen.getByRole('button', { name: 'Join Table 2' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('button', { name: 'Join Table 3' }).getAttribute('aria-busy')).toBeNull();
    // The pressed Join keeps the focus while it is pending.
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Join Table 2' }).disabled).toBe(false);
  });

  it('says Ask to open on a closed table, whose Join registers interest in its game (P-08)', async () => {
    renderList([{ ...TABLE, isOpen: false, openSeats: null }]);
    const ask = await screen.findByRole('button', { name: 'Ask to open Table 2' }, { timeout: 5000 });
    expect(ask.textContent).toBe('Ask to open');
    expect(screen.queryByRole('button', { name: 'Join Table 2' })).toBeNull();
  });
});

/** A member who may join, with a join still on its way, and the list of `tables`. */
function renderList(tables: readonly FloorTable[]) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/rpc/my_feature_access')) return Response.json([{ feature_key: 'waitlist.join', state: 'enabled', tiers: null }]);
      // The join is still on its way.
      if (url.includes('/rpc/join_waitlist')) return new Promise<Response>(() => undefined);
      return Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FloorList tables={tables} places={[]} />
      </RivrDataProvider>,
    );
}
