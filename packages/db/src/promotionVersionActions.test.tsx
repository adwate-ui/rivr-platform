import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { usePromotionVersionActions } from './promotionVersionActions.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000107';
const VENUE = '00000000-0000-4000-8000-000000000001';
const TUESDAY: PromotionTerms = {
  name: 'Tuesday bonus', reward: { kind: 'buyin_bonus', mode: 'percent', percent: 20, capChips: 2_000 },
  eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
  schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-10-01', timezone: 'Asia/Kolkata' }, limits: { perMember: 'per_day' },
  channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: [],
};

/** A fake API: each path answers with its reply, or an error with its status and code; the calls are kept. */
function renderActions(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => usePromotionVersionActions(VENUE), { wrapper });
  return { result, calls, bodyOf: (path: string) => calls.find((call) => call.url.includes(path))?.body };
}

const failure = (code: string) => ({ status: 400, body: { code, message: 'refused', details: null, hint: null } });

/** Two of last week's buy-ins on a Tuesday, as promotion_version_replay gives them: 10,000 and 5,000 of own chips. */
function buyIn(n: number, ownChips: number) {
  return {
    event: { kind: 'buy_in', key: `buy_in:${n}`, at: `2026-10-27T2${n}:00:00+05:30`, memberId: `m${n}`, visitId: `v${n}`, tableId: 't1', stake: 'nlh_50_100',
      ownChips, isFirstOfVisit: true },
    member: { tierId: null, daysSinceJoined: 40, daysSinceLastVisit: 3 },
  };
}

afterEach(cleanup);

const WORDS = { detail: '20% of your buy-in in bonus chips', runs: 'all stakes · Tue, all day' };

describe('promotion version actions', () => {
  it('saves a new draft with its card words and request id, and the next version of a running one by its id', async () => {
    const { result, bodyOf, calls } = renderActions({
      '/rpc/save_promotion_draft': { body: 'v1' }, '/rest/v1/promotion_version': { body: [{ promotion_id: 'p1' }] }, '/rest/v1/': { body: [] },
    });
    let saved: unknown;
    await act(async () => {
      saved = await result.current.saveDraft.mutateAsync({ promotionId: null, terms: TUESDAY, words: WORDS, requestId: 'r1' });
    });
    expect(saved).toEqual({ ok: true, value: { versionId: 'v1', promotionId: 'p1' } });
    expect(bodyOf('save_promotion_draft')).toEqual({
      p_venue_id: VENUE, p_draft: { terms: TUESDAY, ...WORDS, request_id: 'r1' },
    });
    await act(async () => {
      saved = await result.current.saveDraft.mutateAsync({ promotionId: 'p1', terms: TUESDAY, words: WORDS, requestId: 'r2' });
    });
    expect(saved).toEqual({ ok: true, value: { versionId: 'v1', promotionId: 'p1' } });
    expect(calls.filter((call) => call.url.includes('save_promotion_draft'))[1]?.body).toMatchObject({ p_promotion_id: 'p1' });
  });

  it('says a new draft was not saved when its promotion cannot be read back, or the save is refused', async () => {
    const lost = renderActions({ '/rpc/save_promotion_draft': { body: 'v1' }, '/rest/v1/': { body: [] } });
    await act(async () => {
      expect(await lost.result.current.saveDraft.mutateAsync({ promotionId: null, terms: TUESDAY, words: WORDS, requestId: 'r1' })).toEqual({ ok: false, error: 'unavailable' });
    });
    cleanup();
    const refused = renderActions({ '/rpc/save_promotion_draft': failure('RVDEC') });
    await act(async () => {
      expect(await refused.result.current.saveDraft.mutateAsync({ promotionId: 'p1', terms: TUESDAY, words: WORDS, requestId: 'r1' })).toEqual({ ok: false, error: 'already_decided' });
    });
  });

  it('simulates a draft on last week with the domain, and stores the result with the terms it ran on', async () => {
    const { result, bodyOf } = renderActions({
      '/rpc/promotion_version_replay': { body: { from: '2026-10-27T00:30:00+00:00', to: '2026-11-03T00:30:00+00:00', events: [buyIn(1, 10_000), buyIn(2, 5_000)] } },
      '/rpc/record_promotion_simulation': { body: null },
    });
    let run: unknown;
    await act(async () => {
      run = await result.current.simulate.mutateAsync({ versionId: 'v1', terms: TUESDAY });
    });
    const simulation = { events: 2, membersQualified: 2, timesGiven: 2, points: 0, chips: 3_000, spins: 0, perks: 0, isBudgetReached: false };
    expect(run).toEqual({ ok: true, value: { ...simulation, from: new Date('2026-10-27T00:30:00Z'), to: new Date('2026-11-03T00:30:00Z') } });
    expect(bodyOf('record_promotion_simulation')).toEqual({
      p_version_id: 'v1', p_simulation: simulation,
      p_terms: { reward: TUESDAY.reward, eligibility: TUESDAY.eligibility, schedule: TUESDAY.schedule, limits: TUESDAY.limits },
    });
  });

  it('replays last week as if the promotion had run then, though it starts later and ends before', async () => {
    const { result, bodyOf } = renderActions({
      '/rpc/promotion_version_replay': { body: { from: '2026-10-27T00:30:00+00:00', to: '2026-11-03T00:30:00+00:00', events: [buyIn(1, 10_000)] } },
      '/rpc/record_promotion_simulation': { body: null },
    });
    const later = { ...TUESDAY, schedule: { ...TUESDAY.schedule, startsOn: '2026-11-17', endsOn: '2026-11-20' } };
    let run: unknown;
    await act(async () => {
      run = await result.current.simulate.mutateAsync({ versionId: 'v1', terms: later });
    });
    expect(run).toMatchObject({ ok: true, value: { timesGiven: 1, chips: 2_000 } });
    expect(bodyOf('record_promotion_simulation')).toMatchObject({ p_terms: { schedule: { startsOn: '2026-11-17', endsOn: '2026-11-20' } } });
  });

  it('says why a simulation did not run: not allowed, or a replay it cannot read', async () => {
    const refused = renderActions({ '/rpc/promotion_version_replay': failure('42501') });
    await act(async () => {
      expect(await refused.result.current.simulate.mutateAsync({ versionId: 'v1', terms: TUESDAY })).toEqual({ ok: false, error: 'not_allowed' });
    });
    cleanup();
    const garbled = renderActions({ '/rpc/promotion_version_replay': { body: { events: 'none' } } });
    await act(async () => {
      expect(await garbled.result.current.simulate.mutateAsync({ versionId: 'v1', terms: TUESDAY })).toEqual({ ok: false, error: 'unavailable' });
    });
  });

  it('submits, approves, rejects with a reason, pauses and ends, saying why one is refused', async () => {
    const { result, bodyOf } = renderActions({
      '/rpc/submit_promotion_version': failure('RVSIM'), '/rpc/approve_promotion_version': failure('RVTWO'),
      '/rpc/reject_promotion_version': { body: null }, '/rpc/set_promotion_version_live': failure('RVKIL'), '/rpc/end_promotion_version': failure('XX000'),
    });
    await act(async () => {
      expect(await result.current.submit.mutateAsync('v1')).toEqual({ ok: false, error: 'needs_simulation' });
      expect(await result.current.approve.mutateAsync('v1')).toEqual({ ok: false, error: 'own_promotion' });
      expect(await result.current.reject.mutateAsync({ versionId: 'v1', reason: 'Too generous' })).toEqual({ ok: true, value: null });
      expect(await result.current.setLive.mutateAsync({ versionId: 'v1', isLive: false })).toEqual({ ok: false, error: 'switched_off' });
      expect(await result.current.end.mutateAsync('v1')).toEqual({ ok: false, error: 'unavailable' });
    });
    expect(bodyOf('reject_promotion_version')).toEqual({ p_version_id: 'v1', p_reason: 'Too generous' });
    expect(bodyOf('set_promotion_version_live')).toEqual({ p_version_id: 'v1', p_is_live: false });
  });
});
