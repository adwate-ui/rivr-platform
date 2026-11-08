import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactElement } from 'react';
import type { BuilderNames } from '../hooks/useBuilderNames.ts';

/** One reply of the fake API: its body, and a status other than 200 for a refusal. */
export interface Reply {
  readonly status?: number;
  readonly body: unknown;
}

/** A refusal with the database's code, as PostgREST sends it. */
export const refused = (code: string): Reply => ({ status: 400, body: { code, message: 'refused', details: null, hint: null } });

/** Ishita, marketing, who manages promotions: the screens' tests sign her in. */
const SIGNED_IN = '00000000-0000-4000-8000-000000000107';

/** The Tuesday bonus as a version holds it. */
export const TUESDAY: PromotionTerms = {
  name: 'Buy-in bonus Tuesday', reward: { kind: 'seat_bonus', chips: 1_000, firstNSeatsPerTable: 5 },
  eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
  schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-10-01', timezone: 'Asia/Kolkata' }, limits: { perMember: 'none' },
  channels: { playerApp: true, tv: true, website: false, whatsapp: false }, rulesText: [],
};

/** The venue's stakes and tiers as the builder names them. */
export const NAMES: BuilderNames = {
  stakes: [{ code: 'nlh_50_100', name: 'NLH 50/100' }, { code: 'nlh_100_200', name: 'NLH 100/200' }],
  tiers: [{ tierId: 'tier-fc', name: "Founders' Circle" }, { tierId: 'tier-member', name: 'Member' }],
  names: { stakes: { nlh_50_100: 'NLH 50/100', nlh_100_200: 'NLH 100/200' }, tiers: { 'tier-fc': "Founders' Circle", 'tier-member': 'Member' } },
  templateTiers: { founders: 'tier-fc' },
};

/**
 * Renders a promotions screen part signed in, inside the data provider and the console's toasts, with a fake API: each
 * address answers with the first reply whose path it contains, otherwise an empty list. The calls are kept.
 */
export function renderWithApi(ui: ReactElement, replies: Readonly<Record<string, Reply>>) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: SIGNED_IN, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path === undefined ? undefined : replies[path];
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">{ui}</ToastProvider>
    </RivrDataProvider>,
  );
  return { calls, bodiesOf: (rpc: string) => calls.filter((call) => call.url.includes(`/rpc/${rpc}`)).map((call) => call.body) };
}

/** After each test: the screen, the session and the fake API go. */
export function resetApi() {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
}
