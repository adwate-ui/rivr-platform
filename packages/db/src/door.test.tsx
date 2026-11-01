import { createClient } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useDoorScan } from './door.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const KIOSK = '00000000-0000-4000-8000-00000000e002';

/** A fake API: every scan answers with the reply; each scan is kept with what it was sent. */
function renderDoor(reply: { status?: number; body: unknown }) {
  const calls: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    calls.push(init?.body ? JSON.parse(String(init.body)) : undefined);
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(KIOSK), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useDoorScan(), { wrapper });
  return { result, calls };
}

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('The door kiosk', () => {
  it('sends a scan even while the kiosk thinks it is offline, so it never checks a member in or out later', async () => {
    onlineManager.setOnline(false);
    const { result, calls } = renderDoor({ status: 503, body: { message: 'unreachable' } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.mutateAsync(' RIVR-1043 '); });
    expect(outcome).toEqual({ ok: false, error: { reason: 'unavailable', owedSeconds: 0 } });
    expect(calls).toEqual([{ p_code: 'RIVR-1043' }]);
  });
});
