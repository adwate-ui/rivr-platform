import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useOnboardingChecklist } from './onboarding.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';
import { useStaffActions } from './venueStaff.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000103';
const VENUE = '00000000-0000-4000-8000-000000000001';

const CAGE = { staff_id: 'st1', sop_id: 's1', title: 'Cage', version_id: 'v1', version: 2, acknowledged_at: '2026-10-21T08:30:00+00:00' };
const AML = { staff_id: 'st1', sop_id: 's2', title: 'Anti-money laundering', version_id: 'v2', version: 1, acknowledged_at: null };
const DEALER = { staff_id: 'st2', sop_id: 's3', title: 'Dealer certification', version_id: 'v3', version: 1, acknowledged_at: null };

/** A fake API answering the venue's checklists and staff changes; it counts the checklist reads. */
function renderChecklist(staffId: string) {
  const calls: string[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    if (url.includes('/rpc/onboarding_checklists')) return Response.json([CAGE, AML, DEALER]);
    return Response.json([{ id: staffId }]);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ checklist: useOnboardingChecklist(VENUE, staffId), staff: useStaffActions(VENUE) }), { wrapper });
  const reads = () => calls.filter((url) => url.includes('/rpc/onboarding_checklists')).length;
  return { result, reads };
}

afterEach(cleanup);

describe('onboarding checklists', () => {
  it('gives one hire their checklist: each SOP in force that asks their role, ticked when they acknowledged it', async () => {
    const { result } = renderChecklist('st1');
    await waitFor(() => expect(result.current.checklist.data).toEqual([
      { sopId: 's1', title: 'Cage', versionId: 'v1', version: 2, acknowledgedAt: '2026-10-21T08:30:00+00:00' },
      { sopId: 's2', title: 'Anti-money laundering', versionId: 'v2', version: 1, acknowledgedAt: null },
    ]));
  });

  it('gives an empty checklist to a hire whose role no SOP in force asks', async () => {
    const { result } = renderChecklist('st9');
    await waitFor(() => expect(result.current.checklist.data).toEqual([]));
  });

  it('reads the checklists again after a staff change, since a new role changes them', async () => {
    const { result, reads } = renderChecklist('st1');
    await waitFor(() => expect(result.current.checklist.data).toBeDefined());
    expect(reads()).toBe(1);
    await act(async () => { await result.current.staff.change.mutateAsync({ staffId: 'st1', change: { role: 'host' } }); });
    await waitFor(() => expect(reads()).toBe(2));
  });
});
