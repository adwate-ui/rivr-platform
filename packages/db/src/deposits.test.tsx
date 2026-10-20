import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useDepositActions, useDepositDecisions, useDepositDetails, useDeposits, useWaitingDeposits } from './deposits.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VIHAAN = '00000000-0000-4000-8000-000000000212';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: where to pay, the member's deposits, the cage's list, and `refusal` as the error code of every RPC that writes. */
function renderDeposits(details: unknown[], refusal: string | null = null) {
  const calls: { rpc: string; body: unknown }[] = [];
  const reads: Readonly<Record<string, unknown>> = {
    deposit_details: details,
    my_deposits: [{ id: 'd1', amount_paise: 2_000_000, utr: '512345678901', status: 'received', requested_at: '2026-10-20T10:00:00Z',
      decided_at: '2026-10-20T10:05:00Z' }],
    waiting_deposits: [{ request_id: 'd2', member_id: VIHAAN, full_name: 'Vihaan Kapoor', utr: '512345678901', from_vpa: 'vihaan.kapoor@okaxis',
      from_bank: 'Axis Bank', requested_at: '2026-10-20T10:00:00Z', needs_second: false, approved_by: [] }],
  };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const rpc = (input instanceof Request ? input.url : String(input)).split('/rpc/')[1]?.split('?')[0] ?? '';
    calls.push({ rpc, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (rpc in reads) return Response.json(reads[rpc]);
    if (refusal !== null) return Response.json({ code: refusal, message: 'refused' }, { status: 400 });
    return Response.json(rpc === 'request_deposit' ? 'd3' : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(VIHAAN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    details: useDepositDetails(), mine: useDeposits(), actions: useDepositActions(), waiting: useWaitingDeposits(VENUE), decisions: useDepositDecisions(VENUE),
  }), { wrapper });
  return { result, bodies: (rpc: string) => calls.filter((call) => call.rpc === rpc).map((call) => call.body) };
}

afterEach(cleanup);

describe('Deposits', () => {
  it('gives where to pay, the member\'s deposits, and the cage\'s waiting; no details when deposits are closed', async () => {
    const { result } = renderDeposits([{ upi_vpa: 'rivr.gurugram@icici', upi_payee_name: 'RIVR' }]);
    await waitFor(() => expect(result.current.details.data).toEqual({ upiVpa: 'rivr.gurugram@icici', payeeName: 'RIVR' }));
    await waitFor(() => expect(result.current.mine.data?.[0]).toMatchObject({ amount: 2_000_000n, status: 'received', utr: '512345678901' }));
    await waitFor(() => expect(result.current.waiting.data?.[0]).toMatchObject({ depositId: 'd2', fullName: 'Vihaan Kapoor', fromVpa: 'vihaan.kapoor@okaxis', needsSecond: false }));
    const closed = renderDeposits([]);
    await waitFor(() => expect(closed.result.current.details.data).toBeNull());
  });

  it('submits once per request id from a verified UPI account, and sends the bank\'s amount to confirm', async () => {
    const { result, bodies } = renderDeposits([]);
    let asked: unknown;
    await act(async () => {
      asked = await result.current.actions.request.mutateAsync({ amount: fromPaise(2_000_000n), utr: '512345678901', payoutAccountId: 'p1', requestId: 'r1' });
      await result.current.decisions.confirm.mutateAsync({ depositId: 'd2', bankAmount: fromPaise(2_000_000n) });
      await result.current.decisions.secondApprove.mutateAsync('d2');
      await result.current.decisions.reject.mutateAsync('d2');
    });
    expect(asked).toEqual({ ok: true, value: 'd3' });
    expect(bodies('request_deposit')).toEqual([{ p_amount_paise: 2_000_000, p_utr: '512345678901', p_payout_account_id: 'p1', p_idempotency_key: 'r1' }]);
    expect(bodies('confirm_deposit')).toEqual([{ p_request_id: 'd2', p_bank_amount_paise: 2_000_000 }]);
    expect(bodies('second_approve_deposit')).toEqual([{ p_request_id: 'd2' }]);
    expect(bodies('reject_deposit')).toEqual([{ p_request_id: 'd2' }]);
  });

  it.each([['RVUTR', 'utr_used'], ['RVAMT', 'amount_mismatch'], ['RVAPP', 'needs_second'], ['RVPAY', 'not_verified'], ['RVMAX', 'too_many'], ['42501', 'not_allowed'],
    ['XX000', 'unavailable']])(
    'says why a step was refused: %s is %s', async (code, failure) => {
      const { result } = renderDeposits([], code);
      let refused: unknown;
      await act(async () => {
        refused = await result.current.decisions.confirm.mutateAsync({ depositId: 'd2', bankAmount: fromPaise(2_000_000n) });
      });
      expect(refused).toEqual({ ok: false, error: failure });
    },
  );
});
