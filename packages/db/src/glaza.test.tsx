import { fromPaise } from '@rivr/domain/money';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useGlazaStatement, useImportGlaza } from './glaza.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const VENUE = '00000000-0000-4000-8000-000000000001';

/** A fake API: each path answers with its reply; every call is kept with what it sent. */
function renderHooks(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000103'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({
    statement: useGlazaStatement(VENUE, '2026-10-01'), importGlaza: useImportGlaza(VENUE),
  }), { wrapper });
  return { result, calls };
}

const bodyOf = (calls: { url: string; body: unknown }[], path: string) => calls.find((call) => call.url.includes(path))?.body;

afterEach(cleanup);

describe('the Glaza statement', () => {
  it('reads a month\u2019s statement in paise, and imports lines in paise, a refused line said so', async () => {
    const { result, calls } = renderHooks({
      '/rpc/glaza_statement': { body: [{ import_id: 'i1', imported_at: '2026-11-01T10:00:00+00:00', lines: 5, matched: 2, food_comps_paise: 18000,
        soft_drink_comps_paise: 4000, alcohol_comps_paise: 30000, comps_paise: 52000, alcohol_sales_paise: 210000, alcohol_cost_paise: 75000,
        alcohol_margin_paise: 135000, rivr_share_paise: 67500, payable_paise: -15500 }] },
      '/rpc/import_glaza_lines': { status: 400, body: { code: '22023', message: 'outside the month' } },
    });
    await waitFor(() => expect(result.current.statement.data).toEqual({
      importedAt: '2026-11-01T10:00:00+00:00', lines: 5, matched: 2, foodComps: 18000n, softDrinkComps: 4000n, alcoholComps: 30000n, comps: 52000n,
      alcoholSales: 210000n, alcoholCost: 75000n, alcoholMargin: 135000n, rivrShare: 67500n, payable: -15500n,
    }));
    let imported: unknown;
    await act(async () => {
      imported = await result.current.importGlaza.mutateAsync({ month: '2026-10-01', lines: [{ soldAt: '2026-10-14T21:30:00+05:30', tableName: 'Table 3',
        seat: null, item: 'Beer', kind: 'alcohol', quantity: 2, unitCost: fromPaise(15000n), unitPrice: fromPaise(40000n), isComp: false }] });
    });
    expect(imported).toEqual({ ok: false, error: 'invalid' });
    expect(bodyOf(calls, '/rpc/import_glaza_lines')).toEqual({ p_venue_id: VENUE, p_month: '2026-10-01', p_lines: [{ sold_at: '2026-10-14T21:30:00+05:30',
      table_name: 'Table 3', seat: null, item: 'Beer', kind: 'alcohol', quantity: 2, unit_cost_paise: 15000, unit_price_paise: 40000, is_comp: false }] });
  });

  it('is null for a month with no import', async () => {
    const { result } = renderHooks({ '/rpc/glaza_statement': { body: [] } });
    await waitFor(() => expect(result.current.statement.data).toBeNull());
  });
});
