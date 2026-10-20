import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFeatureOverrideActions, useGateableFeatures, useMemberFeatureOverrides } from './featureOverrides.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply (a table read under ''); every call is kept with what it was sent. */
function renderOverrides(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[rpc];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(STAFF), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    overrides: useMemberFeatureOverrides(VENUE, 'm1'), features: useGateableFeatures(), actions: useFeatureOverrideActions(VENUE),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Feature overrides', () => {
  it('gives a member\'s overrides and the gateable features', async () => {
    const { result } = renderOverrides({
      member_feature_overrides: { body: [{
        override_id: 'o1', feature_key: 'learn.library', feature_name: 'Learn library', is_granted: false, reason: 'Sharing drills', until: '2026-11-22',
        standing: 'lifted', created_at: '2026-11-15T10:00:00Z', staff_name: 'Devika Sharma', lifted_by: 'Lakshmi Iyer', lift_reason: 'Settled',
      }] },
      '': { body: [{ key: 'learn.library', name: 'Learn library' }] },
    });
    await waitFor(() => expect(result.current.overrides.data).toEqual([{
      overrideId: 'o1', featureKey: 'learn.library', featureName: 'Learn library', isGranted: false, reason: 'Sharing drills', until: '2026-11-22',
      standing: 'lifted', staffName: 'Devika Sharma', lift: { by: 'Lakshmi Iyer', reason: 'Settled' },
    }]));
    await waitFor(() => expect(result.current.features.data).toEqual([{ key: 'learn.library', name: 'Learn library' }]));
  });

  it('sets an override with its last day, lifts one, and says why one is refused', async () => {
    const { result, calls } = renderOverrides({ lift_feature_override: { status: 400, body: { code: 'RVOVR', message: 'none in force' } } });
    let set: unknown;
    let lifted: unknown;
    await act(async () => {
      set = await result.current.actions.set.mutateAsync({ memberId: 'm1', featureKey: 'learn.library', isGranted: false, reason: 'Sharing drills', until: '2026-11-22' });
      lifted = await result.current.actions.lift.mutateAsync({ overrideId: 'o1', reason: 'Settled' });
    });
    expect(set).toEqual({ ok: true, value: null });
    expect(lifted).toEqual({ ok: false, error: 'not_in_force' });
    expect(calls.find((call) => call.rpc === 'set_feature_override')?.body).toEqual({
      p_venue_id: VENUE, p_member_id: 'm1', p_feature_key: 'learn.library', p_is_granted: false, p_reason: 'Sharing drills', p_until: '2026-11-22',
    });
  });
});
