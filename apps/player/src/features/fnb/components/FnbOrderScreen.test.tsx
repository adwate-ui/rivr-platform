import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FnbOrderScreen } from './FnbOrderScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Signed in on the Menu, with the feature map on its way for good, or failing once and then giving table-side food. */
function renderMenu(map: 'on its way' | 'fails once') {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let asked = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/my_feature_access')) return Response.json([]);
    if (map === 'on its way') return new Promise<Response>(() => undefined);
    if (asked++ === 0) return Response.json({ message: 'unavailable' }, { status: 503 });
    return Response.json([{ feature_key: 'fnb.table_side', state: 'enabled', tiers: null }]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FnbOrderScreen />
    </RivrDataProvider>,
  );
}

describe('the Menu, while the feature map loads or fails (a weak signal in the club)', () => {
  it('says it is loading while the map is on its way', async () => {
    renderMenu('on its way');
    expect(await screen.findByRole('heading', { level: 1, name: 'Menu' })).toBeDefined();
    expect(screen.getByText('Loading')).toBeDefined();
  });

  it('says it could not load when the map fails, and loads on Try again', async () => {
    renderMenu('fails once');
    expect(await screen.findByText('Could not load this. Check the connection and try again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('Could not load this. Check the connection and try again.')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
