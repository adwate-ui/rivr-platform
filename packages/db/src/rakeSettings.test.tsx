import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useRakeChangeActions, useTableTypeRake } from './rakeSettings.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ADMIN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each method and table, as `GET /setting`, answers with its reply; returns the requests made. */
function renderRake(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { method: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET';
    calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[`${method} ${url.pathname.replace('/rest/v1', '')}`];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ADMIN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ rake: useTableTypeRake(VENUE), actions: useRakeChangeActions(VENUE) }), { wrapper });
  return { result, calls };
}

const TYPES = [{ id: 't2', code: 'nlh_100_200', name: 'NLH 100/200', small_blind_paise: 10000, big_blind_paise: 20000 }];
const HOUR = 3_600_000;
const SETTINGS = [
  { id: 's3', subject: 'nlh_100_200', value: { rate_basis_points: 500, cap_paise: 500000 }, effective_from: new Date(Date.now() + 3 * HOUR).toISOString(), reason: 'Quiet nights' },
  { id: 's2', subject: 'nlh_100_200', value: { rate_basis_points: 500, cap_paise: 700000 }, effective_from: new Date(Date.now() + HOUR).toISOString(), reason: 'Weekend cap' },
  { id: 's1', subject: 'nlh_100_200', value: { rate_basis_points: 500, cap_paise: 600000 }, effective_from: '-infinity', reason: 'Seed' },
  { id: 'x1', subject: 'private_room', value: { rate_basis_points: 500, cap_paise: 1200000 }, effective_from: '-infinity', reason: 'Seed' },
];
const READS = { 'GET /table_type': { body: TYPES }, 'GET /setting': { body: SETTINGS } };

afterEach(cleanup);

describe('rake by table type (#37)', () => {
  it('gives each table type the rule in force now and the changes to come, soonest first', async () => {
    const { result } = renderRake(READS);
    await waitFor(() => expect(result.current.rake.data).toHaveLength(1));
    const [type] = result.current.rake.data ?? [];
    expect(type?.inForce).toEqual({ settingId: 's1', rateBasisPoints: 500, cap: 600000n, effectiveFrom: null, reason: 'Seed' });
    expect(type?.scheduled.map((change) => change.settingId)).toEqual(['s2', 's3']);
  });

  it('schedules a change as a rake.config row, and says when the role may not', async () => {
    const { result, calls } = renderRake({ ...READS, 'POST /setting': { status: 403, body: { code: '42501', message: 'rls' } } });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.schedule.mutateAsync({
        tableTypeCode: 'nlh_100_200', rateBasisPoints: 500, capPaise: 700000, effectiveFrom: '2026-10-20T10:00:00+05:30', reason: 'Weekend cap',
      });
    });
    expect(outcome).toEqual({ ok: false, error: 'not_allowed' });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      venue_id: VENUE, key: 'rake.config', subject: 'nlh_100_200', effective_from: '2026-10-20T10:00:00+05:30', reason: 'Weekend cap',
      value: { rate_basis_points: 500, cap_paise: 700000 },
    });
  });

  it('withdraws a change not yet in force, and says when the change is already in force', async () => {
    const withdrawn = renderRake({ ...READS, 'DELETE /setting': { body: [{ id: 's2' }] } });
    let outcome: unknown;
    await act(async () => { outcome = await withdrawn.result.current.actions.withdraw.mutateAsync('s2'); });
    expect(outcome).toEqual({ ok: true, value: null });
    cleanup();
    const inForce = renderRake({ ...READS, 'DELETE /setting': { body: [] } });
    await act(async () => { outcome = await inForce.result.current.actions.withdraw.mutateAsync('s1'); });
    expect(outcome).toEqual({ ok: false, error: 'in_force' });
  });
});
