import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRivrClient, SESSION_STORAGE_KEY } from './client.ts';
import { RivrDataProvider, useAuthStatus } from './provider.tsx';
import { useSignOut } from './signIn.ts';

const SANA = '00000000-0000-4000-8000-000000000104';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A session as the client keeps one after sign-in, for Sana, valid for an hour. */
function storeSession() {
  const user = { id: SANA, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user,
  }));
}

/** The app's own client, with Auth's logout answering as `logout` does; something cached for Sana. */
function renderSignOut(logout: () => Promise<Response>) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return url.includes('/auth/v1/logout') ? logout() : Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const queryClient = new QueryClient();
  queryClient.setQueryData(['user', SANA, 'member'], { name: 'Sana Qureshi' });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RivrDataProvider client={client} queryClient={queryClient}>
      {children}
    </RivrDataProvider>
  );
  const { result } = renderHook(() => ({ auth: useAuthStatus(), signOut: useSignOut() }), { wrapper });
  return { result, queryClient };
}

describe('signing out', () => {
  it('ends the session on this device and forgets everything cached', async () => {
    storeSession();
    const { result, queryClient } = renderSignOut(async () => new Response(null, { status: 204 }));
    await waitFor(() => expect(result.current.auth).toBe('signed-in'));

    await act(() => result.current.signOut.mutateAsync());

    await waitFor(() => expect(result.current.auth).toBe('signed-out'));
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
  });

  it('ends it even when Auth cannot be reached, so the next person at a shared computer starts signed out', async () => {
    storeSession();
    const { result } = renderSignOut(async () => {
      throw new TypeError('Failed to fetch');
    });
    await waitFor(() => expect(result.current.auth).toBe('signed-in'));

    await act(() => result.current.signOut.mutateAsync());

    await waitFor(() => expect(result.current.auth).toBe('signed-out'));
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
