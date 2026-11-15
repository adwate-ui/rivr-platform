import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useResetMemberHours } from './memberHours.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SUPER_ADMIN = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: reset_member_hours answers with the reply; every call is kept with what it was sent. */
function renderReset(reply: { status?: number; body: unknown }) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SUPER_ADMIN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useResetMemberHours(VENUE, 'm1'), { wrapper });
  return { result, calls };
}

async function reset(result: ReturnType<typeof renderReset>['result'], reason: string): Promise<unknown> {
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.mutateAsync(reason);
  });
  return outcome;
}

afterEach(cleanup);

describe('resetting one member’s counted hours (redesign RD-36)', () => {
  it('sends the member and the reason, trimmed', async () => {
    const { result, calls } = renderReset({ body: '2026-11-15T18:00:00+00:00' });
    expect(await reset(result, '  A new season  ')).toEqual({ ok: true, value: null });
    expect(calls.filter((call) => call.rpc === 'reset_member_hours')).toEqual([{ rpc: 'reset_member_hours', body: { p_member_id: 'm1', p_reason: 'A new season' } }]);
  });

  it.each([
    ['42501', 'not_allowed'],
    ['22023', 'invalid'],
    ['RVFRZ', 'paused'],
    ['RVMBR', 'paused'],
    ['XX000', 'unavailable'],
  ])('says why when the database refuses with %s', async (code, failure) => {
    const { result } = renderReset({ status: 400, body: { code, message: 'no' } });
    expect(await reset(result, 'A new season')).toEqual({ ok: false, error: failure });
  });
});
