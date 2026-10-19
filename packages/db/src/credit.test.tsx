import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import { useCreditActions, useCreditLines, useCreditRoom } from './credit.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderCredit(replies: Record<string, { status?: number; body: unknown }>) {
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
  const { result } = renderHook(() => ({ lines: useCreditLines(VENUE), room: useCreditRoom(VENUE), actions: useCreditActions(VENUE) }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('Credit lines', () => {
  it('gives each line in paise, with the limit waiting, and the room against its cap', async () => {
    const { result } = renderCredit({
      credit_lines: { body: [{ line_id: 'l1', member_id: 'm1', full_name: 'Kunal Mehra', limit_paise: 5000000, outstanding_paise: 1000000,
        proposed_limit_paise: 20000000, proposal_reason: 'Plays weekly', proposed_by: 'Aditya Malhotra', exposure_paise: 6000000,
        exposure_cap_paise: 250000000, approval_threshold_paise: 10000000 }] },
      credit_room: { body: [{ exposure_paise: 6000000, exposure_cap_paise: 250000000, approval_threshold_paise: 10000000, minimum_visits: 3 }] },
    });
    await waitFor(() => expect(result.current.lines.data).toEqual([{
      lineId: 'l1', memberId: 'm1', fullName: 'Kunal Mehra', limit: 5_000_000n, outstanding: 1_000_000n,
      proposed: { limit: 20_000_000n, reason: 'Plays weekly', by: 'Aditya Malhotra' },
    }]));
    await waitFor(() => expect(result.current.room.data).toEqual({ exposure: 6_000_000n, cap: 250_000_000n, threshold: 10_000_000n, minimumVisits: 3 }));
  });

  it('reads no room for staff who may not see it', async () => {
    const { result } = renderCredit({ credit_room: { body: [] } });
    await waitFor(() => expect(result.current.room.data).toBeNull());
  });

  it('sets a limit, waiting for approval above the threshold, and says why one is refused', async () => {
    const { result, calls } = renderCredit({ set_credit_limit: { body: 'needs_approval' } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.setLimit.mutateAsync({ phone: '9000000216', limit: fromPaise(20_000_000n), reason: 'Weekly' }); });
    expect(outcome).toEqual({ ok: true, value: 'needs_approval' });
    expect(calls.find((call) => call.rpc === 'set_credit_limit')?.body).toEqual({ p_venue_id: VENUE, p_phone: '9000000216', p_limit_paise: 20000000, p_reason: 'Weekly' });
  });

  it('turns a refusal into its reason', async () => {
    const { result } = renderCredit({
      set_credit_limit: { status: 400, body: { code: 'RVVIS', message: 'visits' } },
      decide_credit_limit: { status: 400, body: { code: '42501', message: 'no' } },
    });
    let set: unknown;
    let decided: unknown;
    await act(async () => { set = await result.current.actions.setLimit.mutateAsync({ phone: '9000000211', limit: fromPaise(5_000_000n), reason: 'New' }); });
    await act(async () => { decided = await result.current.actions.decide.mutateAsync({ lineId: 'l1', isApproved: true, expected: fromPaise(20_000_000n) }); });
    expect(set).toEqual({ ok: false, error: 'too_few_visits' });
    expect(decided).toEqual({ ok: false, error: 'not_allowed' });
  });
});
