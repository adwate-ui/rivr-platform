import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PromotionDraft } from '@rivr/domain/promotions';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { usePromotionActions, usePromotions, usePromotionStakes, usePromotionTemplates } from './promotions.ts';
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
    () => ({ list: usePromotions(VENUE), stakes: usePromotionStakes(VENUE), templates: usePromotionTemplates(VENUE), actions: usePromotionActions(VENUE) }),
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

  it('publishes with the rule and a per-player limit, and pauses through set_promotion_live', async () => {
    const { result, calls } = renderPromotions({ '/rpc/publish_promotion': { body: 'p9' }, '/rest/v1/': { body: [] } });
    let published: unknown;
    await act(async () => {
      published = await result.current.actions.publish.mutateAsync({ name: 'Double points', runs: 'Thursday', draft: DRAFT });
    });
    expect(published).toEqual({ ok: true, value: 'p9' });
    expect(calls.find((call) => call.url.includes('publish_promotion'))?.body).toEqual({
      p_venue_id: VENUE,
      p_promotion: { name: 'Double points', runs: 'Thursday', rule: DRAFT.rule, per_player_limit: 1, per_player_period: 'promotion' },
    });
    await act(async () => {
      await result.current.actions.setLive.mutateAsync({ id: 'p9', isLive: false });
    });
    expect(calls.find((call) => call.url.includes('set_promotion_live'))?.body).toEqual({ p_promotion_id: 'p9', p_is_live: false });
  });

  it('says why a publish was refused: promotions switched off, or not a promotion manager', async () => {
    const { result } = renderPromotions({ '/rpc/publish_promotion': { status: 400, body: { code: 'RVKIL', message: 'off' } }, '/rest/v1/': { body: [] } });
    let refused: unknown;
    await act(async () => {
      refused = await result.current.actions.publish.mutateAsync({ name: 'Double points', runs: 'Thursday', draft: { ...DRAFT, perPlayer: null } });
    });
    expect(refused).toEqual({ ok: false, error: 'switched_off' });
    const { result: other } = renderPromotions({ '/rpc/publish_promotion': { status: 403, body: { code: '42501', message: 'no' } }, '/rest/v1/': { body: [] } });
    await act(async () => {
      refused = await other.current.actions.publish.mutateAsync({ name: 'Double points', runs: 'Thursday', draft: DRAFT });
    });
    expect(refused).toEqual({ ok: false, error: 'not_allowed' });
  });

  it('lists the draft templates and publishes one as it stands (#85)', async () => {
    const { result, calls } = renderPromotions({
      '/rpc/publish_promotion_template': { body: null },
      '/rest/v1/promotion': { body: [{ id: 't1', name: 'Referral', detail: '₹1,000 to each side', runs: 'Every day' }] },
      '/rest/v1/': { body: [] },
    });
    await waitFor(() => expect(result.current.templates.data).toEqual([{ id: 't1', name: 'Referral', detail: '₹1,000 to each side', runs: 'Every day', isLive: false }]));
    expect(calls.find((call) => call.url.includes('status=eq.draft'))?.url).toContain('template_key=not.is.null');
    let published: unknown;
    await act(async () => {
      published = await result.current.actions.publishTemplate.mutateAsync('t1');
    });
    expect(published).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('publish_promotion_template'))?.body).toEqual({ p_promotion_id: 't1' });
  });
});
