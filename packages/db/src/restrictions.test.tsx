import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useRestrictionActions, useRestrictions } from './restrictions.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';

/** A fake API: my_restrictions answers with `row`; every call is kept with what it was sent. */
function renderRestrictions(row: { break_until: string | null; session_reminder_hours: number | null }) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (rpc === 'my_restrictions') return Response.json([row]);
    if (rpc === 'take_break') return Response.json('2026-10-26T18:30:00+00:00');
    return Response.json(null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(MEMBER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ restrictions: useRestrictions(), actions: useRestrictionActions() }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Limits and breaks', () => {
  it('gives the break running now and the session reminder', async () => {
    const { result } = renderRestrictions({ break_until: '2026-10-26T18:30:00+00:00', session_reminder_hours: 6 });
    await waitFor(() => expect(result.current.restrictions.data).toEqual({ breakUntil: '2026-10-26T18:30:00+00:00', sessionReminder: 6 }));
  });

  it('sets a reminder, clears it by leaving the hours out, and takes a break by its days', async () => {
    const { result, calls } = renderRestrictions({ break_until: null, session_reminder_hours: null });
    await waitFor(() => expect(result.current.restrictions.data).toEqual({ breakUntil: null, sessionReminder: null }));
    let taken: unknown;
    await act(async () => {
      await result.current.actions.setReminder.mutateAsync(4);
      await result.current.actions.setReminder.mutateAsync(null);
      taken = await result.current.actions.takeBreak.mutateAsync(7);
    });
    expect(calls.filter((call) => call.rpc !== 'my_restrictions')).toEqual([
      { rpc: 'set_session_reminder', body: { p_hours: 4 } },
      { rpc: 'set_session_reminder', body: {} },
      { rpc: 'take_break', body: { p_days: 7 } },
    ]);
    expect(taken).toEqual({ ok: true, value: '2026-10-26T18:30:00+00:00' });
  });
});
