import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeftOwingCallTime } from './LeftOwingCallTime.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Aditya, an admin, signed in, and a fake API whose list of members who left owing call time fails once, then has Kabir. */
function renderList() {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  let asked = 0;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/left_owing_call_time')) return Response.json([]);
    asked += 1;
    if (asked === 1) return Response.json({ message: 'unreachable' }, { status: 503 });
    return Response.json([{ member_id: 'm1', full_name: 'Kabir Sethi', table_name: 'Table 3', owed_seconds: 1500 }]);
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={queryClient}>
      <LeftOwingCallTime venueId="v1" />
    </RivrDataProvider>,
  );
}

describe('LeftOwingCallTime', () => {
  it('says the list failed to load, under its heading, and Try again loads it, so no member owing call time goes unseen', async () => {
    renderList();
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Could not load this/);
    expect(screen.getByRole('heading', { name: 'Left before call time' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Kabir Sethi')).toBeDefined();
  });
});
