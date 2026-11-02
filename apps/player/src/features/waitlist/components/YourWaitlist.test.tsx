import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type WaitlistPlace } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { YourWaitlist } from './YourWaitlist.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SMALL: WaitlistPlace = {
  entryId: 'e1', tableTypeId: 'tt-small', tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, place: 2, joinedAt: '2026-11-15T15:00:00Z',
  holdUntil: null, callTableName: null, callSeat: null, awayUntil: null, isRequest: false,
};
const BIG: WaitlistPlace = { ...SMALL, entryId: 'e2', tableTypeId: 'tt-big', tableTypeName: 'NLH 100/200' };

describe('YourWaitlist', () => {
  it('offers Leave on each place, and no Step away (decision 0300)', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    vi.stubGlobal('fetch', async () => Response.json([]));
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <YourWaitlist places={[SMALL, BIG]} />
      </RivrDataProvider>,
    );
    expect(screen.getAllByRole('button', { name: /^Leave/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Step away/ })).toBeNull();
  });
});
