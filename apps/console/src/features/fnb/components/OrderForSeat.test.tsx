import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderForSeat } from './OrderForSeat.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Aditya, an admin, signed in, and a fake API whose seats and tables reads answer as given, and every other read with nothing. */
function renderOrder(seats: () => Promise<Response>, tables: () => Promise<Response> = async () => Response.json([])) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/floor_seats')) return seats();
    return url.includes('/rest/v1/game_table') ? tables() : Response.json([]);
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={queryClient}>
      <OrderForSeat venueId="v1" />
    </RivrDataProvider>,
  );
}

describe('OrderForSeat', () => {
  it('says the seats are loading, not that nobody is seated, while the floor is read', async () => {
    renderOrder(() => new Promise<Response>(() => undefined));
    expect(await screen.findByText('Loading')).toBeDefined();
    expect(screen.queryByText('Nobody is seated just now.')).toBeNull();
  });

  it('says the seats failed to load, with Try again, not that nobody is seated', async () => {
    renderOrder(async () => Response.json({ message: 'unreachable' }, { status: 503 }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Could not load this/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.queryByText('Nobody is seated just now.')).toBeNull();
  });

  it('says the seats failed to load when the tables read fails, though the seats answered', async () => {
    // A 500, as supabase-js asks a GET that answered 503 again, after a wait.
    renderOrder(async () => Response.json([]), async () => Response.json({ message: 'server error' }, { status: 500 }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Could not load this/);
    expect(screen.queryByText('Nobody is seated just now.')).toBeNull();
  });

  it('says nobody is seated once the floor has answered with no one', async () => {
    renderOrder(async () => Response.json([]));
    expect(await screen.findByText('Nobody is seated just now.')).toBeDefined();
  });
});
