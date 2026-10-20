import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { usePayoutAccountActions, usePayoutAccountDecisions, usePayoutAccounts, usePayoutAccountsToVerify } from './payoutAccounts.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ISHAAN = '00000000-0000-4000-8000-000000000211';
const VENUE = '00000000-0000-4000-8000-000000000001';
const UPI = { id: 'a1', kind: 'upi', bank_name: 'HDFC Bank', vpa: 'ishaan@hdfcbank', account_number: null, ifsc: null, holder_name: null };

/** A fake API: the member's accounts, the cage's list, and `refusal` as the error code of every RPC that writes. */
function renderPayouts(refusal: string | null = null) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = decodeURIComponent(input instanceof Request ? input.url : String(input));
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/rpc/my_payout_accounts')) {
      return Response.json([{ ...UPI, status: 'verified', reject_reason: null }, { ...UPI, id: 'a2', vpa: 'ishaan@ybl', status: 'rejected', reject_reason: 'Name differs' }]);
    }
    if (url.includes('/rpc/payout_accounts_to_verify')) {
      return Response.json([{ ...UPI, account_id: 'a3', member_id: ISHAAN, full_name: 'Ishaan Verma', phone: '+919000000211', added_at: '2026-10-20T10:00:00Z' }]);
    }
    if (refusal !== null) return Response.json({ code: refusal, message: 'refused' }, { status: 400 });
    return Response.json(url.includes('/rpc/add_payout_account') ? 'a4' : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(ISHAAN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    mine: usePayoutAccounts(), actions: usePayoutAccountActions(), waiting: usePayoutAccountsToVerify(VENUE), decisions: usePayoutAccountDecisions(VENUE),
  }), { wrapper });
  const rpcBodies = (name: string) => calls.filter((call) => call.url.includes(`/rpc/${name}`)).map((call) => call.body);
  return { result, calls, rpcBodies };
}

afterEach(cleanup);

describe('Payout accounts', () => {
  it('lists the member\'s own accounts in use, with where each stands', async () => {
    const { result } = renderPayouts();
    await waitFor(() => expect(result.current.mine.data).toHaveLength(2));
    expect(result.current.mine.data?.map((account) => [account.vpa, account.status, account.rejectReason])).toEqual([
      ['ishaan@hdfcbank', 'verified', null], ['ishaan@ybl', 'rejected', 'Name differs'],
    ]);
  });

  it('adds a UPI address or a bank account with only its own fields, and removes one', async () => {
    const { result, rpcBodies } = renderPayouts();
    const blank = { bankName: 'HDFC Bank', vpa: '', accountNumber: '', ifsc: '', holderName: '' };
    let added: unknown;
    await act(async () => {
      added = await result.current.actions.add.mutateAsync({ ...blank, kind: 'upi', vpa: 'ishaan@hdfcbank' });
      await result.current.actions.add.mutateAsync({ ...blank, kind: 'bank', bankName: 'ICICI Bank', accountNumber: '001234567890', ifsc: 'ICIC0000123', holderName: 'Ishaan Verma' });
      await result.current.actions.remove.mutateAsync('a1');
    });
    expect(added).toEqual({ ok: true, value: 'a4' });
    expect(rpcBodies('add_payout_account')).toEqual([
      { p_kind: 'upi', p_bank_name: 'HDFC Bank', p_vpa: 'ishaan@hdfcbank' },
      { p_kind: 'bank', p_bank_name: 'ICICI Bank', p_account_number: '001234567890', p_ifsc: 'ICIC0000123', p_holder_name: 'Ishaan Verma' },
    ]);
    expect(rpcBodies('remove_payout_account')).toEqual([{ p_account_id: 'a1' }]);
  });

  it.each([['RVMAX', 'too_many'], ['23505', 'already_added'], ['22023', 'invalid'], ['RVMBR', 'stopped'], ['XX000', 'unavailable']])(
    'says why an account was refused: %s is %s', async (code, failure) => {
      const { result } = renderPayouts(code);
      let refused: unknown;
      await act(async () => {
        refused = await result.current.actions.add.mutateAsync({ kind: 'upi', bankName: 'HDFC Bank', vpa: 'ishaan@hdfcbank', accountNumber: '', ifsc: '', holderName: '' });
      });
      expect(refused).toEqual({ ok: false, error: failure });
    },
  );

  it('gives the cage the accounts waiting, with whose they are, and sends a reason only to turn one down', async () => {
    const { result, rpcBodies } = renderPayouts();
    await waitFor(() => expect(result.current.waiting.data?.[0]?.fullName).toBe('Ishaan Verma'));
    expect(result.current.waiting.data?.[0]).toMatchObject({ accountId: 'a3', kind: 'upi', bankName: 'HDFC Bank', vpa: 'ishaan@hdfcbank', memberId: ISHAAN });
    await act(async () => {
      await result.current.decisions.decide.mutateAsync({ accountId: 'a3', isVerified: true, reason: null });
      await result.current.decisions.decide.mutateAsync({ accountId: 'a3', isVerified: false, reason: 'Name differs from KYC' });
    });
    expect(rpcBodies('decide_payout_account')).toEqual([
      { p_account_id: 'a3', p_is_verified: true },
      { p_account_id: 'a3', p_is_verified: false, p_reason: 'Name differs from KYC' },
    ]);
  });
});
