import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarlyDepartures } from './EarlyDepartures.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('EarlyDepartures', () => {
  it('says the list did not load, with Try again, which asks again (F1-24)', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    let asked = 0;
    vi.stubGlobal('fetch', async () => {
      asked += 1;
      return Response.json({ message: 'down' }, { status: 500 });
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EarlyDepartures venueId="v1" memberId="m1" />
      </RivrDataProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }, { timeout: 5000 }));
    await vi.waitFor(() => expect(asked).toBe(2));
  });
});
