import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useShareholdingActions, useShareholdingRegister } from './shareholding.ts';
import { useMyTdsCertificates, useTdsLedger, useTdsReturnExtract } from './tds.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const STAFF = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';
const HOLDER = '00000000-0000-4000-8000-0000000000a1';

/** A fake API: each RPC answers with its reply; every call is kept with what it was sent. */
function renderReports(replies: Record<string, { status?: number; body: unknown }>) {
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
    ledger: useTdsLedger(VENUE, '2026-10-01', '2026-10-31'), extract: useTdsReturnExtract(VENUE), certificates: useMyTdsCertificates(),
    register: useShareholdingRegister(VENUE, '2026-10-26'), registerActions: useShareholdingActions(VENUE),
  }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('TDS reports (#93)', () => {
  it('gives the withholding ledger in paise for the days asked', async () => {
    const { result, calls } = renderReports({ tds_ledger: { body: [{
      member_id: 'm1', full_name: 'Ishaan Verma', member_number: 211, pan_last4: '522C', payments: 2, paid_paise: 7000000, withheld_paise: 600000,
      shadow_paise: 1200000,
    }] } });
    await waitFor(() => expect(result.current.ledger.data).toEqual([{
      memberId: 'm1', fullName: 'Ishaan Verma', memberNumber: 211, panLast4: '522C', payments: 2, paid: 7_000_000n, withheld: 600_000n, shadow: 1_200_000n,
    }]));
    expect(calls.find((call) => call.rpc === 'tds_ledger')?.body).toEqual({ p_venue_id: VENUE, p_from: '2026-10-01', p_to: '2026-10-31' });
  });

  it('takes a quarter\'s extract, and says why one is refused', async () => {
    const taken = renderReports({ tds_return_extract: { body: [{
      deducted_at: '2026-10-26T20:00:00Z', full_name: 'Ishaan Verma', pan: 'ABCPV2522C', section: '194B', taxed_winnings_paise: 2000000,
      rate_basis_points: 3000, tds_paise: 600000,
    }] } });
    let outcome: unknown;
    await act(async () => { outcome = await taken.result.current.extract.mutateAsync('2026-10-01'); });
    expect(outcome).toEqual({ ok: true, value: [{
      deductedAt: '2026-10-26T20:00:00Z', fullName: 'Ishaan Verma', pan: 'ABCPV2522C', section: '194B', taxedWinnings: 2_000_000n,
      rateBasisPoints: 3000, tds: 600_000n,
    }] });
    cleanup();
    const refused = renderReports({ tds_return_extract: { status: 403, body: { code: '42501', message: 'no' } } });
    await act(async () => { outcome = await refused.result.current.extract.mutateAsync('2026-10-01'); });
    expect(outcome).toEqual({ ok: false, error: 'not_allowed' });
  });

  it('gives the member\'s certificate data', async () => {
    const { result } = renderReports({ my_tds_certificates: { body: [{
      venue_id: VENUE, legal_name: 'RIVR Gaming Pvt Ltd', tan: 'DELR12345E', quarter_start: '2026-10-01', section: '194B', pan_last4: '522C', payments: 1,
      paid_paise: 2000000, tds_paise: 600000,
    }] } });
    await waitFor(() => expect(result.current.certificates.data?.[0]).toMatchObject({ tan: 'DELR12345E', quarterStart: '2026-10-01', tds: 600_000n }));
  });
});

describe('the shareholding register (#97)', () => {
  it('gives the register on a day, and records a holding in basis points', async () => {
    const { result, calls } = renderReports({
      shareholding_register: { body: [{ shareholder_id: HOLDER, name: 'Seed Fund', kind: 'investor', basis_points: 4000, effective_from: '2026-01-01' }] },
      record_holding: { status: 400, body: { code: 'RVSHR', message: 'above 100%' } },
    });
    await waitFor(() => expect(result.current.register.data).toEqual([
      { shareholderId: HOLDER, name: 'Seed Fund', kind: 'investor', basisPoints: 4000, effectiveFrom: '2026-01-01' },
    ]));
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.registerActions.recordHolding.mutateAsync({ shareholderId: HOLDER, percent: 7000, effectiveFrom: '2026-06-01', note: '' });
    });
    expect(outcome).toEqual({ ok: false, error: 'above_whole' });
    expect(calls.find((call) => call.rpc === 'record_holding')?.body).toEqual({
      p_venue_id: VENUE, p_shareholder_id: HOLDER, p_basis_points: 7000, p_effective_from: '2026-06-01', p_note: '',
    });
  });
});
