import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBonusFileMembers, useSaveBonusFile } from './bonusFile.ts';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-0000000d0711';
const VENUE = '00000000-0000-4000-8000-000000000001';
const MEMBER = '00000000-0000-4000-8000-000000000215';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function clientFor(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return { wrapper, calls, queryClient };
}

const LINE = { line: 2, memberId: MEMBER, kind: 'add' as const, chips: 500, reason: 'Diwali gift' };

afterEach(cleanup);

describe('Bonus from a file', () => {
  it('reads the members a file names, and nothing until it names one', async () => {
    const { wrapper, calls } = clientFor({
      '/rpc/bonus_file_members': { body: [{
        key: '1042', member_id: MEMBER, member_number: 1042, full_name: 'Ritika Das', in_force_paise: 100_000, owed_paise: 0, is_own: false, is_frozen: true,
      }] },
    });
    const { result } = renderHook(() => ({ none: useBonusFileMembers(VENUE, []), some: useBonusFileMembers(VENUE, ['1042', '+919000000216']) }), { wrapper });
    await waitFor(() => expect(result.current.some.data).toEqual([
      { key: '1042', memberId: MEMBER, memberNumber: 1042, fullName: 'Ritika Das', inForce: 100_000n, owed: 0n, isOwn: false, isFrozen: true },
    ]));
    expect(result.current.none.fetchStatus).toBe('idle');
    expect(calls.map((call) => call.body)).toEqual([{ p_venue_id: VENUE, p_keys: ['1042', '+919000000216'] }]);
  });

  it('says why the members could not be read', async () => {
    const { wrapper } = clientFor({ '/rpc/bonus_file_members': { status: 500, body: { code: 'XX000', message: 'down' } } });
    const { result } = renderHook(() => useBonusFileMembers(VENUE, ['1042']), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('saves a file, and reads every member\'s Bonus, the Members table, History, the door, Bonus given and the reports again', async () => {
    const done = clientFor({ '/rpc/bonus_from_file': { body: 1 } });
    const readAgain = vi.spyOn(done.queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useSaveBonusFile(VENUE), { wrapper: done.wrapper });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.mutateAsync({ lines: [LINE], requestId: 'f1' }); });
    expect(outcome).toEqual({ ok: true, value: 1 });
    expect(done.calls[0]?.body).toEqual({
      p_venue_id: VENUE, p_request_id: 'f1', p_lines: [{ line: 2, member_id: MEMBER, kind: 'add', chips: 500, reason: 'Diwali gift' }],
    });
    expect(readAgain.mock.calls.map(([filters]) => filters?.queryKey?.slice(2)))
      .toEqual([['bonus', VENUE], ['members-list'], ['member-staff-history'], ['door-board', VENUE], ['bonus-given', VENUE], ['club-report', VENUE]]);
  });

  it('says why a file did not save, and the line it names; with no answer it reads nothing again, so the preview stays', async () => {
    const refusals = [['42501', 'not_allowed'], ['RVOWN', 'own_record'], ['RVCHP', 'invalid_chips'], ['22023', 'invalid'], ['RVBON', 'bonus_short'],
      ['RVFRZ', 'paused'], ['RVKIL', 'paused'], ['RVMBR', 'paused'], ['RVRAT', 'busy'], ['XX000', 'unavailable']] as const;
    for (const [code, failure] of refusals) {
      const refused = clientFor({ '/rpc/bonus_from_file': { status: 400, body: { code, message: 'no', details: '7' } } });
      const readAgain = vi.spyOn(refused.queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useSaveBonusFile(VENUE), { wrapper: refused.wrapper });
      let outcome: unknown;
      await act(async () => { outcome = await result.current.mutateAsync({ lines: [LINE], requestId: 'f2' }); });
      expect(outcome).toEqual({ ok: false, error: { failure, line: 7 } });
      expect(readAgain.mock.calls.length > 0).toBe(failure !== 'unavailable');
      cleanup();
    }
    for (const details of [null, '', 'Changed: x']) {
      const refused = clientFor({ '/rpc/bonus_from_file': { status: 400, body: { code: '22023', message: 'no', details } } });
      const { result } = renderHook(() => useSaveBonusFile(VENUE), { wrapper: refused.wrapper });
      let outcome: unknown;
      await act(async () => { outcome = await result.current.mutateAsync({ lines: [LINE], requestId: 'f3' }); });
      expect(outcome).toEqual({ ok: false, error: { failure: 'invalid', line: null } });
    }
  });
});
