import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useControlActions, useEngagedControls } from './killSwitch.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** The RPC a request calls, or the table it reads. */
function routeOf(input: RequestInfo | URL): string {
  const url = input instanceof Request ? input.url : String(input);
  return url.split('/rpc/')[1] ?? url.split('/rest/v1/')[1]?.split('?')[0] ?? '';
}

/** A fake API: each RPC answers with its reply, a table read by its table's name; every call is kept with what it was sent. */
function renderKillSwitch(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = routeOf(input);
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ engaged: useEngagedControls(VENUE), actions: useControlActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Kill switch', () => {
  it('gives engaged controls, with a freeze\'s release ask', async () => {
    const { result } = renderKillSwitch({ engaged_controls: { body: [{
      control_id: 'c1', level: 'venue_freeze', feature: null, member_name: null, staff_name: null, reason: 'Dispute', engaged_at: '2026-11-15T20:00:00Z',
      engaged_by: 'Devika Sharma', release_asked_by: 'Devika Sharma', release_reason: 'Settled',
    }] } });
    await waitFor(() => expect(result.current.engaged.data?.[0]).toMatchObject({
      controlId: 'c1', level: 'venue_freeze', releaseAsk: { by: 'Devika Sharma', reason: 'Settled' },
    }));
  });

  it('engages a member freeze for the member with that mobile number', async () => {
    const { result, calls } = renderKillSwitch({ member: { body: [{ id: 'm1' }] }, engage_control: { body: 'c2' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.engage.mutateAsync({ level: 'member_freeze', reason: 'Chargeback', feature: null, memberPhone: '+919876543210', staffPhone: null });
    });
    expect(outcome).toEqual({ ok: true, value: 'c2' });
    expect(calls.find((call) => call.rpc === 'engage_control')?.body).toEqual({
      p_venue_id: VENUE, p_level: 'member_freeze', p_reason: 'Chargeback', p_member_id: 'm1',
    });
  });

  it('says when no member has the number, when the lookup fails, and when a freeze needs a second super admin', async () => {
    const { result } = renderKillSwitch({
      member: { body: [] },
      staff: { status: 500, body: { code: 'XX000', message: 'down' } },
      release_control: { status: 400, body: { code: 'RVTWO', message: 'second' } },
    });
    let engaged: unknown;
    let revoked: unknown;
    let released: unknown;
    await act(async () => {
      engaged = await result.current.actions.engage.mutateAsync({ level: 'member_freeze', reason: 'Chargeback', feature: null, memberPhone: '+919000000999', staffPhone: null });
      revoked = await result.current.actions.engage.mutateAsync({ level: 'access_revoke', reason: 'Lost phone', feature: null, memberPhone: null, staffPhone: '+919000000104' });
      released = await result.current.actions.release.mutateAsync({ controlId: 'c1', reason: '' });
    });
    expect(engaged).toEqual({ ok: false, error: 'no_member' });
    expect(revoked).toEqual({ ok: false, error: 'unavailable' });
    expect(released).toEqual({ ok: false, error: 'needs_second' });
  });

  it('asks to release a freeze, then a second super admin releases it', async () => {
    const { result } = renderKillSwitch({ release_control: { body: 'awaiting_second' } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.release.mutateAsync({ controlId: 'c1', reason: 'Settled' });
    });
    expect(outcome).toEqual({ ok: true, value: 'awaiting_second' });
  });
});
