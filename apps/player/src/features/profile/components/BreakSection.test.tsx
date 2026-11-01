import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BreakSection } from './BreakSection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Kabir signed in, and a fake API that keeps each break taken. */
function renderBreak() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000202', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const taken: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/take_break')) {
      taken.push(JSON.parse(String(init?.body)));
      return Response.json('2026-11-08T10:00:00Z');
    }
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <BreakSection restrictions={{ breakUntil: null, sessionReminder: null }} />
    </RivrDataProvider>,
  );
  return taken;
}

describe('BreakSection', () => {
  it('asks once more before the break chosen starts, as it cannot be shortened, and Cancel takes none', async () => {
    const taken = renderBreak();
    fireEvent.click(screen.getByRole('button', { name: 'Take a break' }));
    fireEvent.click(screen.getByRole('button', { name: /^30 days/ }));
    expect(screen.getByText(/^Take a break until .+\? It cannot be shortened\.$/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(taken).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Take a break' }));
    fireEvent.click(screen.getByRole('button', { name: /^7 days/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, take the break' }));
    await waitFor(() => expect(taken).toEqual([{ p_days: 7 }]));
  });
});
