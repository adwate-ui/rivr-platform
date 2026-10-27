import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useChangeMemberPhone } from './memberPhone.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SUPER_ADMIN = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: change_member_phone answers with the reply; every call is kept with what it was sent. */
function renderChange(reply: { status?: number; body: unknown }) {
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
  const { result } = renderHook(() => useChangeMemberPhone(VENUE, 'm1'), { wrapper });
  return { result, calls };
}

async function change(result: ReturnType<typeof renderChange>['result'], phone: string, reason: string): Promise<unknown> {
  let outcome: unknown;
  await act(async () => {
    outcome = await result.current.mutateAsync({ phone, reason });
  });
  return outcome;
}

afterEach(cleanup);

describe('changing a member phone number', () => {
  it('sends the member, the number and the reason, trimmed', async () => {
    const { result, calls } = renderChange({ body: null });
    expect(await change(result, ' +919812345678 ', ' Lost his phone ')).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.rpc === 'change_member_phone')?.body)
      .toEqual({ p_member_id: 'm1', p_phone: '+919812345678', p_reason: 'Lost his phone' });
  });

  it('says why a change was refused', async () => {
    const refusals: [string, string][] = [
      ['42501', 'not_allowed'], ['22023', 'invalid'], ['RVPHN', 'taken'], ['RVSTF', 'staff_login'], ['RVERD', 'erased'],
      ['RVFRZ', 'paused'], ['RVMBR', 'paused'], ['XX000', 'unavailable'],
    ];
    for (const [code, failure] of refusals) {
      const { result } = renderChange({ status: 400, body: { code, message: 'refused' } });
      expect(await change(result, '+919812345678', 'Lost his phone')).toEqual({ ok: false, error: failure });
      cleanup();
    }
  });
});
