import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { simulationOf, useLastWeekReplay } from './promotionReplay.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000101';
// 20% of a Tuesday buy-in up to 2,000, from a later start day than the week replayed.
const TUESDAY: PromotionTerms = {
  name: 'Tuesday bonus', reward: { kind: 'buyin_bonus', mode: 'percent', percent: 20, capChips: 2_000 },
  eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
  schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-11-17', endsOn: '2026-11-17', timezone: 'Asia/Kolkata' },
  limits: { perMember: 'none' }, channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: [],
};

/** Last Tuesday's buy-ins of 10,000 and 5,000 of own chips, as promotion_version_replay gives them. */
const REPLAY = {
  from: '2026-10-27T00:30:00+00:00', to: '2026-11-03T00:30:00+00:00',
  events: [10_000, 5_000].map((ownChips, n) => ({
    event: { kind: 'buy_in', key: `buy_in:${n}`, at: `2026-10-27T2${n}:00:00+05:30`, memberId: `m${n}`, visitId: `v${n}`, tableId: 't1', stake: 'nlh_50_100',
      ownChips, isFirstOfVisit: true },
    member: { tierId: null, daysSinceJoined: 40, daysSinceLastVisit: 3 },
  })),
};

function renderReplay(reply: { status?: number; body: unknown }) {
  const fetch: typeof globalThis.fetch = async () => Response.json(reply.body, { status: reply.status ?? 200 });
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // No retries, so a refusal is an error at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  return renderHook(() => useLastWeekReplay('v2', TUESDAY), { wrapper }).result;
}

afterEach(cleanup);

describe("last week replayed for the approver", () => {
  it('weighs the replay afresh, as if the version had run last week', async () => {
    const result = renderReplay({ body: REPLAY });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toMatchObject({ events: 2, membersQualified: 2, timesGiven: 2, chips: 3_000, from: new Date('2026-10-27T00:30:00Z') });
  });

  it('fails when the database refuses it or its answer cannot be read', async () => {
    const refused = renderReplay({ status: 400, body: { code: '42501', message: 'refused', details: null, hint: null } });
    await waitFor(() => expect(refused.current.isError).toBe(true));
    cleanup();
    expect(simulationOf({ events: 'none' }, TUESDAY)).toBeNull();
  });
});
