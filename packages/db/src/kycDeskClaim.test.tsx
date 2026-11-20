import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SESSION_STORAGE_KEY, type RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useKycDeskClaim, useKycDeskClaims } from './kycDeskClaim.ts';
import { RivrDataProvider } from './provider.tsx';

const NAINA = '00000000-0000-4000-8000-000000000203';
const ASHA = { staff_name: 'Asha Rao', since: '2026-11-20T14:30:00Z' };

/** A reviewer signed in over a fake PostgREST that answers each RPC as a test says, and records what was asked. */
function renderOver<T>(answers: Record<string, () => Response>, hook: () => T) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const asked: string[] = [];
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: {
      fetch: async (input) => {
        const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
        asked.push(path);
        return (answers[path] ?? (() => Response.json([])))();
      },
    },
    auth: { storageKey: SESSION_STORAGE_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return { ...renderHook(hook, { wrapper }), asked };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const claimAnswering = (answer: () => Response) => renderOver({ '/rest/v1/rpc/claim_kyc_desk_check': answer }, () => useKycDeskClaim('v1'));

describe('useKycDeskClaim (the owner, 20 Nov)', () => {
  it('claims a member no one else is checking', async () => {
    const { result } = claimAnswering(() => Response.json([{ status: 'claimed', staff_name: null, since: ASHA.since }]));
    expect(await act(() => result.current.claim.mutateAsync(NAINA))).toEqual({ ok: true, value: { status: 'claimed' } });
  });

  it('says who is checking them elsewhere, and since when', async () => {
    const { result } = claimAnswering(() => Response.json([{ status: 'taken', ...ASHA }]));
    expect(await act(() => result.current.claim.mutateAsync(NAINA)))
      .toEqual({ ok: true, value: { status: 'taken', staffName: 'Asha Rao', since: new Date(ASHA.since) } });
  });

  it('says who checked them already and when, or no one where no one reviewed the check', async () => {
    const named = claimAnswering(() => Response.json([{ status: 'decided', ...ASHA }]));
    expect(await act(() => named.result.current.claim.mutateAsync(NAINA)))
      .toEqual({ ok: true, value: { status: 'decided', staffName: 'Asha Rao', at: new Date(ASHA.since) } });
    cleanup();
    const unnamed = claimAnswering(() => Response.json([{ status: 'decided', staff_name: null, since: null }]));
    expect(await act(() => unnamed.result.current.claim.mutateAsync(NAINA)))
      .toEqual({ ok: true, value: { status: 'decided', staffName: null, at: null } });
  });

  it('reads an answer it does not know as unavailable, never as a claim', async () => {
    const empty = claimAnswering(() => Response.json([]));
    expect(await act(() => empty.result.current.claim.mutateAsync(NAINA))).toEqual({ ok: false, error: 'unavailable' });
    cleanup();
    const nameless = claimAnswering(() => Response.json([{ status: 'taken', staff_name: null, since: null }]));
    expect(await act(() => nameless.result.current.claim.mutateAsync(NAINA))).toEqual({ ok: false, error: 'unavailable' });
  });

  it('reads the gate\'s refusals as the check would, and anything else as unavailable', async () => {
    const refused = claimAnswering(() => Response.json({ code: '42501', message: 'no' }, { status: 403 }));
    expect(await act(() => refused.result.current.claim.mutateAsync(NAINA))).toEqual({ ok: false, error: 'not_allowed' });
    cleanup();
    const frozen = claimAnswering(() => Response.json({ code: 'RVFRZ', message: 'frozen' }, { status: 400 }));
    expect(await act(() => frozen.result.current.claim.mutateAsync(NAINA))).toEqual({ ok: false, error: 'stopped' });
    cleanup();
    const down = claimAnswering(() => Response.json({ code: 'XX000', message: 'down' }, { status: 500 }));
    expect(await act(() => down.result.current.claim.mutateAsync(NAINA))).toEqual({ ok: false, error: 'unavailable' });
  });

  it('lets the claim go, and asks again who others are checking', async () => {
    const { result, asked } = renderOver({}, () => ({ ...useKycDeskClaim('v1'), holders: useKycDeskClaims('v1') }));
    await waitFor(() => expect(result.current.holders.isSuccess).toBe(true));
    const before = asked.filter((path) => path === '/rest/v1/rpc/kyc_desk_claims').length;
    await act(() => result.current.release.mutateAsync(NAINA));
    expect(asked).toContain('/rest/v1/rpc/release_kyc_desk_check');
    await waitFor(() => expect(asked.filter((path) => path === '/rest/v1/rpc/kyc_desk_claims').length).toBeGreaterThan(before));
  });
});

describe('useKycDeskClaims (the owner, 20 Nov)', () => {
  it('is who other staff are checking now, by member', async () => {
    const { result } = renderOver({ '/rest/v1/rpc/kyc_desk_claims': () => Response.json([{ member_id: NAINA, ...ASHA }]) }, () => useKycDeskClaims('v1'));
    await waitFor(() => expect(result.current.data?.get(NAINA)).toEqual({ staffName: 'Asha Rao', since: new Date(ASHA.since) }));
  });
});
