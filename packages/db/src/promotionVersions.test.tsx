import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { approverViewOf, useMemberPromotionGrants, usePromotionsOverview, usePromotionVersions } from './promotionVersions.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000107';
const VENUE = '00000000-0000-4000-8000-000000000001';
// @rivr/testing's buildPromotionTerms, which @rivr/db does not depend on.
const TERMS: PromotionTerms = {
  name: 'Double points', reward: { kind: 'points_multiplier', multiplier: 2 }, eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
  schedule: { days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', to: '06:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' }, limits: { perMember: 'none' },
  channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: [],
};

/** A fake API: each path answers with its reply; the calls are kept. */
function renderVersions(replies: Record<string, unknown>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    return Response.json(path ? replies[path] : null);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ overview: usePromotionsOverview(VENUE), versions: usePromotionVersions('p1'), grants: useMemberPromotionGrants('m1', 20) }),
    { wrapper },
  );
  return { result, calls };
}

function overviewRow(more: Record<string, unknown>) {
  return {
    promotion_id: 'p1', template_key: null, status: 'live', name: 'Double points', detail: '2× points', runs: 'all stakes · every day, all day',
    current_version_id: 'v1', current_status: 'live', open_version_id: null, open_status: null, rejected_reason: null, reward: TERMS.reward,
    eligibility: TERMS.eligibility, schedule: TERMS.schedule, limits: TERMS.limits, channels: TERMS.channels, given_this_week: 41, chips_given_this_week: 12_000, points_given_this_week: 0, budget_used_chips: 30_000, is_quiet: true, is_legacy: false, ended_at: null,
    created_at: '2026-11-03T10:00:00+00:00', ...more,
  };
}

function versionRow(more: Record<string, unknown>) {
  return {
    id: 'v1', version: 1, status: 'live', name: TERMS.name, reward: TERMS.reward, eligibility: TERMS.eligibility, schedule: TERMS.schedule,
    limits: TERMS.limits, channels: TERMS.channels, rules_text: [], link: null, detail: '2× points', runs: 'Every day', author: 'Ishita Bose',
    is_mine: false, submitted_at: '2026-11-02T10:00:00+00:00', decided_by: 'Vikram Rao', decided_at: '2026-11-02T11:00:00+00:00', rejected_reason: null,
    simulation: { events: 3, membersQualified: 2, timesGiven: 2, points: 240, chips: 0, spins: 0, perks: 0, isBudgetReached: false }, simulated_terms: null,
    ...more,
  };
}

afterEach(cleanup);

describe('promotions in versions: the list', () => {
  it('lists each promotion with the status the list shows, its terms and this week\'s grants, and counts each status', async () => {
    const { result, calls } = renderVersions({
      '/rpc/promotions_overview': [
        overviewRow({}),
        overviewRow({ promotion_id: 'p2', current_version_id: null, current_status: null, open_version_id: 'v9', open_status: 'awaiting_approval', status: 'pending' }),
        overviewRow({ promotion_id: 'p3', current_status: 'live', open_version_id: 'v4', open_status: 'draft', rejected_reason: 'Too generous' }),
        overviewRow({ promotion_id: 'p4', current_version_id: null, current_status: null, status: 'pending', is_legacy: true, reward: {} }),
      ],
    });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    const promotions = result.current.overview.data?.promotions ?? [];
    expect(promotions.map((one) => [one.id, one.status, one.openStatus])).toEqual([
      ['p1', 'live', null], ['p2', 'awaiting_approval', 'awaiting_approval'], ['p3', 'live', 'draft'], ['p4', 'awaiting_approval', null],
    ]);
    expect(promotions[0]).toMatchObject({ givenThisWeek: 41, chipsGivenThisWeek: 12_000, pointsGivenThisWeek: 0, budgetUsedChips: 30_000, isQuiet: true, terms: { reward: TERMS.reward }, isLegacy: false });
    expect(promotions[2]?.rejectedReason).toBe('Too generous');
    expect(promotions[3]?.terms).toBeNull();
    expect(result.current.overview.data?.counts).toEqual({ all: 4, live: 2, awaiting_approval: 2, scheduled: 0, paused: 0, draft: 0, ended: 0 });
    expect(calls.find((call) => call.url.includes('promotions_overview'))?.body).toEqual({ p_venue_id: VENUE });
  });

  it('counts a running promotion whose new version waits under its own status and under awaiting approval', async () => {
    const { result } = renderVersions({ '/rpc/promotions_overview': [overviewRow({ open_version_id: 'v2', open_status: 'awaiting_approval' })] });
    await waitFor(() => expect(result.current.overview.data).toBeDefined());
    expect(result.current.overview.data?.promotions[0]?.status).toBe('live');
    expect(result.current.overview.data?.counts).toMatchObject({ all: 1, live: 1, awaiting_approval: 1, draft: 0 });
  });

  it('reads terms it cannot parse as none', async () => {
    const { result } = renderVersions({ '/rpc/promotions_overview': [overviewRow({ reward: { kind: 'cash' } })] });
    await waitFor(() => expect(result.current.overview.data?.promotions[0]?.terms).toBeNull());
  });
});

describe('promotions in versions: versions and the approver', () => {
  it('reads a promotion\'s versions with their terms, link and simulation', async () => {
    const { result } = renderVersions({
      '/rpc/promotion_versions_of': [
        versionRow({ id: 'v2', version: 2, status: 'awaiting_approval', name: 'Triple points', reward: { kind: 'points_multiplier', multiplier: 3 },
          link: 'https://rivr.club/triple', is_mine: true, simulation: null }),
        versionRow({}),
      ],
    });
    await waitFor(() => expect(result.current.versions.data).toHaveLength(2));
    const [waiting, live] = result.current.versions.data ?? [];
    expect(waiting).toMatchObject({ version: 2, status: 'awaiting_approval', isMine: true, simulation: null, terms: { link: 'https://rivr.club/triple' } });
    expect(live?.simulation?.timesGiven).toBe(2);
    expect(approverViewOf(result.current.versions.data ?? [])).toEqual({ live, waiting, changed: ['name', 'reward', 'link'] });
  });

  it('shows every part as new when nothing runs yet, and nothing to approve when nothing waits', () => {
    const draft = { id: 'v1', version: 1, status: 'awaiting_approval' as const, terms: TERMS, detail: null, runs: null, author: null, isMine: false,
      submittedAt: null, decidedBy: null, decidedAt: null, rejectedReason: null, simulation: null };
    expect(approverViewOf([draft]).changed).toEqual(['name', 'reward', 'eligibility', 'schedule', 'limits', 'channels', 'rulesText', 'link']);
    expect(approverViewOf([{ ...draft, status: 'live' }])).toEqual({ live: { ...draft, status: 'live' }, waiting: null, changed: [] });
    expect(approverViewOf([{ ...draft, terms: null }, { ...draft, id: 'v0', status: 'live' }]).changed).toHaveLength(8);
  });

  it('reads what promotions gave a member, for the Visits tab', async () => {
    const { result } = renderVersions({
      '/rpc/member_promotion_grants': [{ grant_id: 'g1', granted_at: '2026-11-03T15:30:00+00:00', club_day: '2026-11-03', promotion_name: 'Tuesday bonus',
        version: 2, points: 0, chips: 1000, spins: 0, perk: null }],
    });
    await waitFor(() => expect(result.current.grants.data).toEqual([
      { id: 'g1', grantedAt: '2026-11-03T15:30:00+00:00', clubDay: '2026-11-03', promotion: 'Tuesday bonus', version: 2, points: 0, chips: 1000, spins: 0, perk: null },
    ]));
  });
});
