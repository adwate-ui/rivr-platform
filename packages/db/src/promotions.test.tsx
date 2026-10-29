import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fromPaise } from '@rivr/domain/money';
import type { PromotionDraft } from '@rivr/domain/promotions';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import {
  usePromotionActions, usePromotionDecisions, usePromotions, usePromotionsAwaitingApproval, usePromotionsSentBack, usePromotionSimulation, usePromotionStakes, usePromotionTemplates,
} from './promotions.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000107';
const VENUE = '00000000-0000-4000-8000-000000000001';

/** What the fake API was asked: the address, the method and the body sent. */
function callOf(url: string, init: RequestInit | undefined) {
  return { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

/** A fake API: each path answers with its reply. */
function renderPromotions(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(callOf(url, init));
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({
      list: usePromotions(VENUE), stakes: usePromotionStakes(VENUE), templates: usePromotionTemplates(VENUE), actions: usePromotionActions(VENUE),
      simulation: usePromotionSimulation(VENUE), awaiting: usePromotionsAwaitingApproval(VENUE),
      decisions: usePromotionDecisions(VENUE), sentBack: usePromotionsSentBack(VENUE),
    }),
    { wrapper },
  );
  return { result, calls };
}

const DRAFT: PromotionDraft = {
  rule: { trigger: 'hours_played', conditions: { days: [4] }, effect: { kind: 'points', multiplier_percent: 200 } },
  perPlayer: { limit: 1, period: 'promotion' },
};

afterEach(cleanup);

describe('Promotions (#84)', () => {
  it('lists live and paused promotions with their card words, and the stakes the builder offers', async () => {
    const { result, calls } = renderPromotions({
      '/rest/v1/promotion': { body: [{ id: 'p1', name: 'Double points', detail: null, runs: '100/200 · Thursday', status: 'paused' }] },
      '/rest/v1/table_type': { body: [{ code: 'nlh_100_200', name: 'NLH 100/200' }] },
    });
    await waitFor(() => expect(result.current.list.data).toEqual([{ id: 'p1', name: 'Double points', detail: null, runs: '100/200 · Thursday', isLive: false }]));
    await waitFor(() => expect(result.current.stakes.data).toEqual([{ code: 'nlh_100_200', name: 'NLH 100/200' }]));
    expect(calls.find((call) => call.url.includes('/rest/v1/promotion'))?.url).toContain('status=in.%28live%2Cpaused%29');
  });

  it('submits with the rule and a per-player limit, and pauses through set_promotion_live', async () => {
    const { result, calls } = renderPromotions({ '/rpc/submit_promotion': { body: 'p9' }, '/rest/v1/': { body: [] } });
    let submitted: unknown;
    await act(async () => {
      submitted = await result.current.actions.submit.mutateAsync({
        name: 'Double points', runs: 'Thursday', draft: DRAFT, rules: ['Members only'], questions: [{ question: 'Do I claim it?', answer: 'No.' }],
      });
    });
    expect(submitted).toEqual({ ok: true, value: 'p9' });
    expect(calls.find((call) => call.url.includes('submit_promotion'))?.body).toEqual({
      p_venue_id: VENUE,
      p_promotion: {
        name: 'Double points', runs: 'Thursday', rule: DRAFT.rule, per_player_limit: 1, per_player_period: 'promotion',
        rules: ['Members only'], questions: [{ question: 'Do I claim it?', answer: 'No.' }],
      },
    });
    await act(async () => {
      await result.current.actions.setLive.mutateAsync({ id: 'p9', isLive: false });
    });
    expect(calls.find((call) => call.url.includes('set_promotion_live'))?.body).toEqual({ p_promotion_id: 'p9', p_is_live: false });
  });

  it('says why a submission was refused: promotions switched off, or not a promotion manager', async () => {
    const { result } = renderPromotions({ '/rpc/submit_promotion': { status: 400, body: { code: 'RVKIL', message: 'off' } }, '/rest/v1/': { body: [] } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.actions.submit.mutateAsync({ name: 'Double points', runs: 'Thursday', draft: { ...DRAFT, perPlayer: null } });
    });
    expect(refused).toEqual({ ok: false, error: 'switched_off' });
    const { result: other } = renderPromotions({ '/rpc/submit_promotion': { status: 403, body: { code: '42501', message: 'no' } }, '/rest/v1/': { body: [] } });
    await act(async () => {
      refused = await other.current.actions.submit.mutateAsync({ name: 'Double points', runs: 'Thursday', draft: DRAFT });
    });
    expect(refused).toEqual({ ok: false, error: 'not_allowed' });
  });

  it('lists the draft templates and submits one as it stands (#85)', async () => {
    const { result, calls } = renderPromotions({
      '/rpc/submit_promotion_template': { body: null },
      '/rest/v1/promotion': { body: [{ id: 't1', name: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' }] },
      '/rest/v1/': { body: [] },
    });
    await waitFor(() => expect(result.current.templates.data).toEqual([{ id: 't1', name: 'Referral', detail: '₹1,000 to each side', runs: 'Every day', isLive: false }]));
    expect(calls.find((call) => call.url.includes('status=eq.draft'))?.url).toContain('template_key=not.is.null');
    let submitted: unknown;
    await act(async () => {
      submitted = await result.current.actions.submitTemplate.mutateAsync({ id: 't1', budget: null });
    });
    expect(submitted).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('submit_promotion_template'))?.body).toEqual({ p_promotion_id: 't1' });
    await act(async () => {
      await result.current.actions.submitTemplate.mutateAsync({ id: 't1', budget: { paise: fromPaise(5_000_000n), period: 'month' } });
    });
    expect(calls.filter((call) => call.url.includes('submit_promotion_template')).at(-1)?.body)
      .toEqual({ p_promotion_id: 't1', p_budget_paise: 5_000_000, p_budget_period: 'month' });
  });

  it('lists the promotions waiting for a super admin, and approves or refuses one', async () => {
    const { result, calls } = renderPromotions({
      '/rpc/promotions_awaiting_approval': {
        body: [{ promotion_id: 'p9', name: 'Double points', detail: null, runs: 'Thursday', template_key: null, requested_by: 'Ishita Bose',
                 requested_at: '2026-10-27T10:00:00Z', is_mine: false, rules: [{ trigger: 'buy_in', conditions: {}, effect: { kind: 'spin' } }],
                 per_player_limit: 1, per_player_period: 'day', budget_paise: 500000, budget_count: null, budget_period: 'month',
                 website_rules: ['Members only'], website_questions: [{ question: 'Do I claim it?', answer: 'No.' }] },
               { promotion_id: 'p8', name: 'Odd', detail: null, runs: 'Any', template_key: null, requested_by: 'Ishita Bose',
                 requested_at: '2026-10-27T11:00:00Z', is_mine: true, rules: [{ trigger: 'lunch', conditions: {}, effect: { kind: 'spin' } }],
                 per_player_limit: null, per_player_period: null, budget_paise: null, budget_count: null, budget_period: null,
                 website_rules: [], website_questions: [] }],
      },
      '/rpc/approve_promotion': { body: null },
      '/rpc/refuse_promotion': { body: null },
      '/rest/v1/': { body: [] },
    });
    await waitFor(() => expect(result.current.awaiting.data).toEqual([
      { id: 'p9', name: 'Double points', detail: null, runs: 'Thursday', requestedBy: 'Ishita Bose', requestedAt: '2026-10-27T10:00:00Z', isMine: false,
        rules: [{ trigger: 'buy_in', conditions: {}, effect: { kind: 'spin' } }], perPlayer: { limit: 1, period: 'day' }, budget: { paise: 500000n, count: null, period: 'month' },
        websiteRules: ['Members only'], websiteQuestions: [{ question: 'Do I claim it?', answer: 'No.' }] },
      // A rule the console cannot read is null, so it can only be refused.
      { id: 'p8', name: 'Odd', detail: null, runs: 'Any', requestedBy: 'Ishita Bose', requestedAt: '2026-10-27T11:00:00Z', isMine: true,
        rules: null, perPlayer: null, budget: { paise: null, count: null, period: 'promotion' }, websiteRules: [], websiteQuestions: [] },
    ]));
    let approved: unknown;
    await act(async () => {
      approved = await result.current.decisions.approve.mutateAsync('p9');
    });
    expect(approved).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('approve_promotion'))?.body).toEqual({ p_promotion_id: 'p9' });
    await act(async () => {
      await result.current.decisions.refuse.mutateAsync({ id: 'p9', reason: 'Too generous' });
    });
    expect(calls.find((call) => call.url.includes('refuse_promotion'))?.body).toEqual({ p_promotion_id: 'p9', p_reason: 'Too generous' });
  });

  it('says a super admin does not approve their own promotion', async () => {
    const { result } = renderPromotions({ '/rpc/approve_promotion': { status: 400, body: { code: 'RVTWO', message: 'own' } }, '/rest/v1/': { body: [] } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.decisions.approve.mutateAsync('p9');
    });
    expect(refused).toEqual({ ok: false, error: 'own_promotion' });
  });

  it('says when another super admin already decided it, and lists what was sent back', async () => {
    const { result } = renderPromotions({
      '/rpc/approve_promotion': { status: 400, body: { code: 'RVDEC', message: 'decided' } },
      '/rpc/promotions_sent_back': {
        body: [{ promotion_id: 'p7', name: 'Too generous', detail: null, runs: 'Every night', template_key: null, refused_by: 'Vikram Rao',
                 refused_at: '2026-10-27T12:00:00Z', refused_reason: 'Fifty points a night is too many' }],
      },
      '/rest/v1/': { body: [] },
    });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.decisions.approve.mutateAsync('p9');
    });
    expect(refused).toEqual({ ok: false, error: 'already_decided' });
    await waitFor(() => expect(result.current.sentBack.data).toEqual([
      { id: 'p7', name: 'Too generous', detail: null, runs: 'Every night', isTemplate: false, refusedBy: 'Vikram Rao', refusedAt: '2026-10-27T12:00:00Z',
        reason: 'Fifty points a night is too many' },
    ]));
  });
});

// The simulation before publishing (#144).
describe('Promotion simulation', () => {
  const WEEK = { from: '2026-11-12T00:30:00+00:00', to: '2026-11-19T00:30:00+00:00' };
  const visit = (member: number, points: number) => ({
    at: '2026-11-13T15:00:00+00:00', member, tier_id: null, table_id: 't3', stake: 'nlh_100_200', amount_paise: 0, points, hours_played: 3,
  });

  it('replays last week with the rule, as the engine would: once per member', async () => {
    const { result, calls } = renderPromotions({
      '/rpc/promotion_replay': { body: { ...WEEK, events: [visit(1, 60), visit(1, 40), visit(2, 30)] } },
      '/rest/v1/': { body: [] },
    });
    let simulated: unknown;
    await act(async () => {
      simulated = await result.current.simulation.mutateAsync(DRAFT);
    });
    expect(simulated).toEqual({
      ok: true,
      value: {
        events: 3, grants: 2, members: 2, cost: 0n, points: 90n, budgetLeft: null, isBudgetReached: false,
        from: new Date(WEEK.from), to: new Date(WEEK.to),
      },
    });
    expect(calls.find((call) => call.url.includes('promotion_replay'))?.body).toEqual({
      p_venue_id: VENUE, p_trigger: 'hours_played', p_conditions: { days: [4] },
    });
  });

  it.each([
    [{ status: 403, body: { code: '42501', message: 'no' } }, 'not_allowed'],
    [{ status: 400, body: { code: '22023', message: 'no' } }, 'not_replayable'],
    [{ status: 500, body: { code: 'XX000', message: 'down' } }, 'unavailable'],
    [{ body: { from: 'yesterday', events: [] } }, 'unavailable'],
  ])('says why a simulation did not run (%#)', async (reply, failure) => {
    const { result } = renderPromotions({ '/rpc/promotion_replay': reply, '/rest/v1/': { body: [] } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.simulation.mutateAsync(DRAFT);
    });
    expect(refused).toEqual({ ok: false, error: failure });
  });
});
