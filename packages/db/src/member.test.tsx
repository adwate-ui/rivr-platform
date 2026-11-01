import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMember } from './member.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ASHA = '00000000-0000-4000-8000-000000000211';

/** Asha signed in, and a fake API whose member reads answer in turn from `reads`; every call is kept. */
function renderMember(reads: unknown[]) {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (url.includes('/rpc/link_my_login')) return new Response(null, { status: 204 });
    return Response.json(reads.shift() ?? null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ASHA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => useMember(), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('the signed-in member', () => {
  it('reads the member of this login, with the initial the shell shows', async () => {
    const { result, calls } = renderMember([{ id: 'm1', full_name: ' asha Verma' }]);
    await waitFor(() => expect(result.current.data).toEqual({ id: 'm1', fullName: ' asha Verma', initial: 'A' }));
    expect(calls.some((url) => url.includes('/rpc/link_my_login'))).toBe(false);
  });

  it('links a login with no member yet once, then asks again, as the app may have closed between the code and the link', async () => {
    const { result, calls } = renderMember([null, { id: 'm1', full_name: 'Asha Verma' }]);
    await waitFor(() => expect(result.current.data).toEqual({ id: 'm1', fullName: 'Asha Verma', initial: 'A' }));
    expect(calls.filter((url) => url.includes('/rpc/link_my_login'))).toHaveLength(1);
  });

  it('is null for a login that is no member, as staff and the public are', async () => {
    const { result } = renderMember([null, null]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
