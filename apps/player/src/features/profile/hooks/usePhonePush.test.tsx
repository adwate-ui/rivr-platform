import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePhonePush } from './usePhonePush.ts';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('usePhonePush', () => {
  it('works again and says it failed when the browser throws on the permission ask, as an older Safari does (F3-29)', async () => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
    vi.stubGlobal('fetch', async () => Response.json([]));
    // A browser with push, no subscription yet, whose permission ask throws rather than answering.
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: () => { throw new TypeError('requestPermission needs a callback'); } });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null } }) } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </RivrDataProvider>
    );
    const { result } = renderHook(() => usePhonePush(), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('off'));
    await act(() => result.current.change(true));
    expect(result.current.isBusy).toBe(false);
    expect(result.current.failed).toBe(true);
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });
});
