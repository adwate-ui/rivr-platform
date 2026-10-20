import { indianMobileSchema } from '@rivr/contracts/identity';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useStaffActions, useVenueStaff } from './venueStaff.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000150';
const VENUE = '00000000-0000-4000-8000-000000000001';

type Reply = { status?: number; body: unknown };

/** A fake API: the staff list for a read, and `write` for an insert or update; every request is kept. */
function renderStaff(list: unknown[], write: Reply = { status: 201, body: null }) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = method === 'GET' ? { body: list } : write;
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ staff: useVenueStaff(VENUE), actions: useStaffActions(VENUE) }), { wrapper });
  return { result, calls };
}

const AYESHA = { id: 's1', full_name: 'Ayesha Thomas', job_title: 'Floor manager', role: 'admin', phone: '+919000000150', is_active: true, user_id: SIGNED_IN };
const PEMA = { id: 's2', full_name: 'Pema Lepcha', job_title: 'Dealer', role: 'dealer', phone: null, is_active: false, user_id: null };

afterEach(cleanup);

describe('useVenueStaff', () => {
  it('lists the venue\'s staff with job title and role apart, and marks the signed-in one', async () => {
    const { result, calls } = renderStaff([AYESHA, PEMA]);
    await waitFor(() => expect(result.current.staff.data).toEqual([
      { staffId: 's1', fullName: 'Ayesha Thomas', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000150', isActive: true, isMe: true },
      { staffId: 's2', fullName: 'Pema Lepcha', jobTitle: 'Dealer', role: 'dealer', phone: null, isActive: false, isMe: false },
    ]));
    expect(calls[0]?.url).toContain(`venue_id=eq.${VENUE}`);
    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain('order=is_active.desc,full_name.asc');
  });
});

describe('useStaffActions', () => {
  it('adds someone at the venue with their job title, role and number', async () => {
    const { result, calls } = renderStaff([]);
    const added = await act(() => result.current.actions.add.mutateAsync({ fullName: 'Test Host', jobTitle: 'Floor supervisor', role: 'host', phone: null }));
    expect(added).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ venue_id: VENUE, full_name: 'Test Host', job_title: 'Floor supervisor', role: 'host', phone: null });
  });

  it('changes one column at a time: job title, role, or whether they\'re active', async () => {
    const { result, calls } = renderStaff([], { body: [{ id: 's2' }] });
    await act(() => result.current.actions.change.mutateAsync({ staffId: 's2', change: { jobTitle: 'Senior dealer' } }));
    await act(() => result.current.actions.change.mutateAsync({ staffId: 's2', change: { role: 'host' } }));
    await act(() => result.current.actions.change.mutateAsync({ staffId: 's2', change: { isActive: true } }));
    expect(calls.filter((call) => call.method === 'PATCH').map((call) => call.body)).toEqual([{ job_title: 'Senior dealer' }, { role: 'host' }, { is_active: true }]);
  });

  it('says why a change was refused, and that a change to someone out of reach is not allowed', async () => {
    const refused = (code: string) => renderStaff([], { status: 400, body: { code, message: 'no' } });
    const own = refused('RVOWN');
    expect(await act(() => own.result.current.actions.change.mutateAsync({ staffId: 's1', change: { role: 'host' } }))).toEqual({ ok: false, error: 'own_change' });
    cleanup();
    const last = refused('RVLCK');
    expect(await act(() => last.result.current.actions.change.mutateAsync({ staffId: 's1', change: { isActive: false } }))).toEqual({ ok: false, error: 'last_super_admins' });
    cleanup();
    const again = refused('23505');
    expect(await act(() => again.result.current.actions.add.mutateAsync({ fullName: 'X', jobTitle: 'Host', role: 'host', phone: indianMobileSchema.parse('9000000901') })))
      .toEqual({ ok: false, error: 'already_staff' });
    cleanup();
    const role = refused('42501');
    expect(await act(() => role.result.current.actions.add.mutateAsync({ fullName: 'X', jobTitle: 'Cashier', role: 'cashier', phone: null }))).toEqual({ ok: false, error: 'not_allowed' });
    cleanup();
    const hidden = renderStaff([], { body: [] });
    expect(await act(() => hidden.result.current.actions.change.mutateAsync({ staffId: 's9', change: { jobTitle: 'Host' } }))).toEqual({ ok: false, error: 'not_allowed' });
  });
});
