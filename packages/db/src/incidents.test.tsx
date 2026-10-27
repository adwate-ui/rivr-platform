import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useContacts, useDrills, useIncidentActions, useIncidents } from './incidents.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it was sent. */
function renderIncidents(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, method: String(init?.method), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const reply = replies[Object.keys(replies).find((key) => url.includes(key)) ?? ''];
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ contacts: useContacts(VENUE), incidents: useIncidents(VENUE), drills: useDrills(VENUE), actions: useIncidentActions(VENUE) }),
    { wrapper },
  );
  return { result, calls };
}

const EMPTY = { '/rest/v1/contact': { body: [] }, '/rest/v1/incident': { body: [] }, '/rest/v1/drill': { body: [] } };

afterEach(cleanup);

describe('Incidents', () => {
  it('reads the contacts, the incidents with their SOP and logger by name, and the drills', async () => {
    const { result } = renderIncidents({
      '/rest/v1/contact': { body: [{ id: 'c1', kind: 'police', name: 'Police', role: 'Emergency', phone: '112', notes: '' }] },
      '/rest/v1/incident': { body: [{
        id: 'i1', occurred_at: '2026-10-20T23:10:00+05:30', severity: 'high', summary: 'A disputed pot', cctv_reference: 'Camera 4, 23:10',
        sop: { title: 'Disputes' }, staff: { full_name: 'Pema Lepcha' },
      }] },
      '/rest/v1/drill': { body: [{ id: 'd1', title: 'Outage drill', scheduled_on: '2026-11-20', held_on: null, sop: null }] },
    });
    await waitFor(() => expect(result.current.contacts.data).toEqual([
      { contactId: 'c1', kind: 'police', name: 'Police', role: 'Emergency', phone: '112', notes: '' },
    ]));
    await waitFor(() => expect(result.current.incidents.data?.[0]).toMatchObject({ sopTitle: 'Disputes', loggedByName: 'Pema Lepcha', cctvReference: 'Camera 4, 23:10' }));
    await waitFor(() => expect(result.current.drills.data).toEqual([
      { drillId: 'd1', title: 'Outage drill', sopTitle: null, scheduledOn: '2026-11-20', heldOn: null },
    ]));
  });

  it('logs an incident with no camera as none, and says why a drill was not marked held', async () => {
    const { result, calls } = renderIncidents({ ...EMPTY, '/rpc/hold_drill': { status: 400, body: { code: 'RVDUP', message: 'held' } } });
    let outcome: unknown;
    await act(async () => { outcome = await result.current.actions.log.mutateAsync({ severity: 'low', summary: ' A spill ', occurredAt: null, cctvReference: ' ', cameraId: null, sopId: null }); });
    expect(outcome).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rest/v1/incident') && call.method === 'POST')?.body)
      .toEqual({ venue_id: VENUE, severity: 'low', summary: 'A spill', cctv_reference: null, camera_id: null, sop_id: null });
    await act(async () => { outcome = await result.current.actions.holdDrill.mutateAsync('d1'); });
    expect(outcome).toEqual({ ok: false, error: 'held' });
  });

  it('schedules drills with or without the SOP they rehearse', async () => {
    const { result, calls } = renderIncidents({ ...EMPTY, '/rpc/schedule_drills': { body: 4 } });
    await act(async () => { await result.current.actions.scheduleDrills.mutateAsync({ title: 'Outage drill', sopId: null, firstOn: '2026-11-20' }); });
    expect(calls.find((call) => call.url.includes('schedule_drills'))?.body).toEqual({ p_venue_id: VENUE, p_title: 'Outage drill', p_first_on: '2026-11-20' });
  });
});
