import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveStatusPlugin } from '../nativePhone.ts';
import { useNativePhone } from './useNativePhone.ts';

const TOKEN = 'dXk3:APA91bHPRgkF3JUikC4ENAHEeMrd41Zxv';
const NEW_KEY = 'f0'.repeat(32);
const KEPT_KEY = 'e1'.repeat(32);

/** The native plugin as a phone answers it: what it kept, whether it may notify, and what it was asked. */
function phone({ kept = { token: null, deviceKey: null }, permission = 'prompt', refuses = false }: {
  kept?: { token: string | null; deviceKey: string | null }; permission?: PermissionState; refuses?: boolean;
} = {}) {
  const asked: string[] = [];
  const plugin: LiveStatusPlugin = {
    checkPermissions: async () => ({ notifications: permission }),
    register: async ({ channelName }) => {
      asked.push(`register ${channelName}`);
      if (refuses) {
        permission = 'denied';
        throw new Error('denied');
      }
      return { platform: 'android', token: TOKEN };
    },
    current: async () => kept,
    keepDeviceKey: async ({ deviceKey }) => { asked.push(`keep ${deviceKey}`); kept = { token: TOKEN, deviceKey }; },
    unregister: async () => {
      asked.push('unregister');
      const token = kept.token;
      kept = { token: null, deviceKey: null };
      return { token };
    },
  };
  return { plugin, asked };
}

/** The database's answers: the new key for a save, nothing for a removal; what it was asked. */
function database() {
  const rpcs: { name: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const name = String(input).split('/rpc/')[1] ?? '';
    rpcs.push({ name, body: init?.body ? JSON.parse(String(init.body)) : null });
    return name === 'save_live_status_device' ? Response.json(NEW_KEY) : new Response(null, { status: 204 });
  });
  return rpcs;
}

function render(plugin: LiveStatusPlugin | null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </RivrDataProvider>
  );
  return renderHook(() => useNativePhone(plugin), { wrapper }).result;
}

beforeEach(() => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000211', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('useNativePhone', () => {
  it('is unsupported in a browser, where web push does the work', () => {
    expect(render(null).current.state).toBe('unsupported');
  });

  it('is off on a phone never turned on; turning it on asks leave, saves the phone and keeps its key', async () => {
    const rpcs = database();
    const { plugin, asked } = phone();
    const result = render(plugin);
    await waitFor(() => expect(result.current.state).toBe('off'));

    await act(() => result.current.change(true));

    expect([result.current.state, result.current.failed]).toEqual(['on', false]);
    expect(asked).toEqual(['register Live status', `keep ${NEW_KEY}`]);
    expect(rpcs).toEqual([{ name: 'save_live_status_device', body: { p_platform: 'android', p_token: TOKEN } }]);
  });

  it('saves a phone already on again when opened, with the key it kept, so it moves to whoever signed in on it', async () => {
    const rpcs = database();
    const { plugin, asked } = phone({ kept: { token: TOKEN, deviceKey: KEPT_KEY }, permission: 'granted' });
    const result = render(plugin);

    await waitFor(() => expect(result.current.state).toBe('on'));

    expect(rpcs).toEqual([{ name: 'save_live_status_device', body: { p_platform: 'android', p_token: TOKEN, p_device_key: KEPT_KEY } }]);
    expect(asked).toEqual(['register Live status', `keep ${NEW_KEY}`]);
  });

  it('is blocked once the phone refuses notifications, whether before or when asked', async () => {
    database();
    const denied = render(phone({ permission: 'denied' }).plugin);
    await waitFor(() => expect(denied.current.state).toBe('blocked'));

    const result = render(phone({ refuses: true }).plugin);
    await waitFor(() => expect(result.current.state).toBe('off'));
    await act(() => result.current.change(true));
    expect([result.current.state, result.current.failed]).toEqual(['blocked', false]);
  });

  it('turns off: ends what the lock screen shows and forgets the phone', async () => {
    const rpcs = database();
    const { plugin, asked } = phone({ kept: { token: TOKEN, deviceKey: KEPT_KEY }, permission: 'granted' });
    const result = render(plugin);
    await waitFor(() => expect(result.current.state).toBe('on'));

    await act(() => result.current.change(false));

    expect(result.current.state).toBe('off');
    expect(asked.at(-1)).toBe('unregister');
    expect(rpcs.at(-1)).toEqual({ name: 'remove_live_status_device', body: { p_token: TOKEN } });
  });

  it('stays off and says it failed when the phone gives no token the database takes', async () => {
    database();
    const { plugin } = phone();
    const result = render({ ...plugin, register: async () => ({ platform: 'android', token: 'short' }) });
    await waitFor(() => expect(result.current.state).toBe('off'));

    await act(() => result.current.change(true));

    expect([result.current.state, result.current.failed]).toEqual(['off', true]);
  });
});
