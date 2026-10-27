import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useGrowthFunnel, useMisReport } from './reports.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const OWNER = '00000000-0000-4000-8000-000000000101';
const VENUE = '00000000-0000-4000-8000-000000000001';

const BASE = {
  month: '2026-02-01', hands: 0, rake_paise: 0, drop_paise: 0, rake_by_table: [], rake_by_dealer: [], rake_by_variant: [], revenue: [], expenses: [],
  revenue_paise: 0, expense_paise: 0, net_paise: 0, visits: 0, members: 0,
};

/** A fake API whose mis_report_for answers with `report`. */
function renderMis(report: object) {
  const fetch: typeof globalThis.fetch = async () => Response.json([{ report, generated_at: null, is_preview: true }]);
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(OWNER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return renderHook(() => useMisReport(VENUE, '2026-02-01'), { wrapper }).result;
}

afterEach(cleanup);

describe('the monthly MIS, with promotion cost and cohorts', () => {
  it('gives each promotion\'s cost against its budget, and each cohort\'s months as the database gives them', async () => {
    const months = [{ month: '2025-12-01', returned: 3, percent: 100 }, { month: '2026-01-01', returned: 2, percent: 66 }];
    const result = renderMis({
      ...BASE,
      promotions: [
        { id: 'p1', name: 'Referral', grants: 1, cost_paise: 50000, cost_to_date_paise: 80000, budget_paise: 100000, budget_grants: null },
        { id: 'p2', name: 'Happy hour', grants: 4, cost_paise: 20000, cost_to_date_paise: 20000, budget_paise: null, budget_grants: 50 },
      ],
      cohorts: [{ month: '2025-12-01', members: 3, months }],
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.promotions).toEqual([
      { id: 'p1', name: 'Referral', grants: 1, cost: 50_000n, costToDate: 80_000n, budget: 100_000n, budgetGrants: null },
      { id: 'p2', name: 'Happy hour', grants: 4, cost: 20_000n, costToDate: 20_000n, budget: null, budgetGrants: 50 },
    ]);
    expect(result.current.data?.cohorts).toEqual([{ month: '2025-12-01', members: 3, months }]);
  });

  it('reads a month stored before promotion cost and cohorts as having none', async () => {
    const result = renderMis(BASE);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.promotions).toEqual([]);
    expect(result.current.data?.cohorts).toEqual([]);
  });
});

describe('the growth funnel', () => {
  it('gives each source\'s members at each stage, as the database counts them', async () => {
    const rows = [
      { source_kind: 'direct', source_code: null, signed_up: 5, kyc_done: 4, visited: 3, bought_in: 2 },
      { source_kind: 'link', source_code: 'instagram', signed_up: 2, kyc_done: 1, visited: 1, bought_in: 0 },
    ];
    const fetch: typeof globalThis.fetch = async () => Response.json(rows);
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch },
      auth: { storage: sessionStorageFor(OWNER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useGrowthFunnel(VENUE), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([
      { sourceKind: 'direct', sourceCode: null, signedUp: 5, kycDone: 4, visited: 3, boughtIn: 2 },
      { sourceKind: 'link', sourceCode: 'instagram', signedUp: 2, kycDone: 1, visited: 1, boughtIn: 0 },
    ]);
  });
});
