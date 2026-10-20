import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useSopAcknowledgements, useSopActions, useSopLibrary } from './sops.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply. */
function renderSops(replies: Record<string, { status?: number; body: unknown }>) {
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
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ library: useSopLibrary(VENUE), acks: useSopAcknowledgements('v1'), actions: useSopActions(VENUE) }),
    { wrapper },
  );
  return { result, calls };
}

const NO_NEXT = { next_version_id: null, next_version: null, next_owner: null, next_ack_roles: null, next_effective_on: null, next_body: null };
const ROW = {
  sop_id: 's1', title: 'Cage', version_id: 'v1', version: 2, owner: 'Duty manager', ack_roles: ['cashier'], effective_on: '2026-10-20',
  body: '1. Count the float.', ...NO_NEXT, must_acknowledge: true, acknowledged_at: null, acknowledged_count: 1, required_count: 4,
};
const WAITING = {
  ...ROW, sop_id: 's2', title: 'Opening the room', version_id: null, version: null, owner: null, ack_roles: null, effective_on: null, body: null,
  next_version_id: 'v9', next_version: 1, next_owner: 'Duty manager', next_ack_roles: ['host'], next_effective_on: '2026-10-27',
  next_body: '1. Lights.', must_acknowledge: false, required_count: 0, acknowledged_count: 0,
};
const EMPTY = { '/rpc/sop_library': { body: [] }, '/rpc/sop_acknowledgements': { body: [] } };

afterEach(cleanup);

describe('SOPs', () => {
  it('lists each SOP with its version in force, or its first version waiting for its day', async () => {
    const { result } = renderSops({ ...EMPTY, '/rpc/sop_library': { body: [ROW, WAITING] } });
    await waitFor(() => expect(result.current.library.data).toEqual([
      {
        sopId: 's1', title: 'Cage', next: null, mustAcknowledge: true, acknowledgedAt: null, acknowledgedCount: 1, requiredCount: 4,
        current: { versionId: 'v1', version: 2, owner: 'Duty manager', ackRoles: ['cashier'], effectiveOn: '2026-10-20', body: '1. Count the float.' },
      },
      {
        sopId: 's2', title: 'Opening the room', current: null, mustAcknowledge: false, acknowledgedAt: null, acknowledgedCount: 0, requiredCount: 0,
        next: { versionId: 'v9', version: 1, owner: 'Duty manager', ackRoles: ['host'], effectiveOn: '2026-10-27', body: '1. Lights.' },
      },
    ]));
  });

  it('lists who a version asks, with when each acknowledged', async () => {
    const { result } = renderSops({
      ...EMPTY, '/rpc/sop_acknowledgements': { body: [{ staff_id: 'st1', full_name: 'Sana Qureshi', role: 'cashier', acknowledged_at: null }] },
    });
    await waitFor(() => expect(result.current.acks.data).toEqual([{ staffId: 'st1', fullName: 'Sana Qureshi', role: 'cashier', acknowledgedAt: null }]));
  });

  it('acknowledges, publishes and adds, and says why one did not go through', async () => {
    const { result, calls } = renderSops({
      ...EMPTY, '/rpc/acknowledge_sop': { body: '2026-10-20T10:00:00+00:00' }, '/rpc/publish_sop_version': { status: 400, body: { code: '22023', message: 'day' } },
      '/rpc/add_sop': { status: 409, body: { code: '23505', message: 'taken' } },
    });
    const version = { owner: 'Duty manager', ackRoles: ['cashier'] as const, effectiveOn: '2026-10-19', body: 'Text' };
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.acknowledge.mutateAsync('v1'); });
    expect(outcome).toEqual({ ok: true, value: null });
    await act(async () => { outcome = await result.current.actions.publish.mutateAsync({ sopId: 's1', ...version }); });
    expect(outcome).toEqual({ ok: false, error: 'day' });
    expect(calls.find((call) => call.url.includes('publish_sop_version'))?.body).toEqual({
      p_sop_id: 's1', p_owner: 'Duty manager', p_ack_roles: ['cashier'], p_effective_on: '2026-10-19', p_body: 'Text',
    });
    await act(async () => { outcome = await result.current.actions.add.mutateAsync({ title: 'Cage', ...version }); });
    expect(outcome).toEqual({ ok: false, error: 'taken' });
  });

  it('says when a newer version came into force before the acknowledgement', async () => {
    const { result } = renderSops({ ...EMPTY, '/rpc/acknowledge_sop': { status: 400, body: { code: 'RVSTL', message: 'stale' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.acknowledge.mutateAsync('v1'); });
    expect(outcome).toEqual({ ok: false, error: 'changed' });
  });
});
