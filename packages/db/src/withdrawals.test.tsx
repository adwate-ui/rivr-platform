import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useWaitingWithdrawals, useWithdrawalActions, useWithdrawalDecisions, useWithdrawals } from './withdrawals.ts';

const ARJUN = '00000000-0000-4000-8000-000000000201';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: the member's withdrawals, the cage's list, and `refusal` as the error code of every RPC that writes. */
function renderWithdrawals(refusal: string | null = null) {
  const calls: { rpc: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1]?.split('?')[0] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (rpc === 'my_withdrawals') {
      return Response.json([{ id: 'w1', amount_paise: 10_000_000, status: 'sent', utr: '412908771204', decline_reason: null, requested_at: '2026-10-20T10:00:00Z',
        decided_at: '2026-10-20T10:05:00Z', kind: 'upi', bank_name: 'HDFC Bank' }]);
    }
    if (rpc === 'waiting_withdrawals') {
      return Response.json([{ request_id: 'w2', member_id: ARJUN, full_name: 'Arjun Mehta', amount_paise: 10_000_000, kind: 'upi', bank_name: 'HDFC Bank',
        vpa: 'arjun.mehta@hdfcbank', account_number: null, ifsc: null, holder_name: null, requested_at: '2026-10-20T10:00:00Z', needs_second: true,
        approved_by: ['Devika Rana'] }]);
    }
    if (refusal !== null) return Response.json({ code: refusal, message: 'refused' }, { status: 400 });
    return Response.json(rpc === 'request_withdrawal' ? 'w3' : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ARJUN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    mine: useWithdrawals(), actions: useWithdrawalActions(), waiting: useWaitingWithdrawals(VENUE), decisions: useWithdrawalDecisions(VENUE),
  }), { wrapper });
  return { result, bodies: (rpc: string) => calls.filter((call) => call.rpc === rpc).map((call) => call.body) };
}

afterEach(cleanup);

describe('Withdrawals', () => {
  it('gives the member\'s withdrawals with the bank each went to, and the cage\'s waiting with its second approvals', async () => {
    const { result } = renderWithdrawals();
    await waitFor(() => expect(result.current.mine.data?.[0]).toMatchObject({ amount: 10_000_000n, status: 'sent', utr: '412908771204', bankName: 'HDFC Bank' }));
    await waitFor(() => expect(result.current.waiting.data?.[0]).toMatchObject({
      withdrawalId: 'w2', fullName: 'Arjun Mehta', amount: 10_000_000n, needsSecond: true, approvedBy: ['Devika Rana'],
    }));
  });

  it('asks once per request id, and sends each step of the cage as the database takes it', async () => {
    const { result, bodies } = renderWithdrawals();
    let asked: unknown;
    await act(async () => {
      asked = await result.current.actions.request.mutateAsync({ amount: fromPaise(10_000_000n), payoutAccountId: 'p1', requestId: 'r1' });
      await result.current.decisions.secondApprove.mutateAsync('w2');
      await result.current.decisions.send.mutateAsync({ withdrawalId: 'w2', utr: '412908771204' });
      await result.current.decisions.decline.mutateAsync({ withdrawalId: 'w2', reason: 'Name differs' });
    });
    expect(asked).toEqual({ ok: true, value: 'w3' });
    expect(bodies('request_withdrawal')).toEqual([{ p_amount_paise: 10_000_000, p_payout_account_id: 'p1', p_idempotency_key: 'r1' }]);
    expect(bodies('second_approve_withdrawal')).toEqual([{ p_request_id: 'w2' }]);
    expect(bodies('send_withdrawal')).toEqual([{ p_request_id: 'w2', p_utr: '412908771204' }]);
    expect(bodies('decline_withdrawal')).toEqual([{ p_request_id: 'w2', p_reason: 'Name differs' }]);
  });

  it.each([['RVSHT', 'wallet_short'], ['RVPND', 'already_waiting'], ['RVAPP', 'needs_second'], ['RVUTR', 'utr_used'], ['RVKIL', 'switched_off'],
    ['XX000', 'unavailable']])('says why a step was refused: %s is %s', async (code, failure) => {
    const { result } = renderWithdrawals(code);
    let refused: unknown;
    await act(async () => {
      refused = await result.current.decisions.send.mutateAsync({ withdrawalId: 'w2', utr: '412908771204' });
    });
    expect(refused).toEqual({ ok: false, error: failure });
  });
});
