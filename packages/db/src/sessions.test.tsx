import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useMySessions } from './sessions.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const MEMBER = '00000000-0000-4000-8000-000000000211';

/** A fake API: my_sessions answers with the rows given. */
function renderSessions(rows: unknown) {
  const fetch: typeof globalThis.fetch = async () => Response.json(rows);
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(MEMBER), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return renderHook(() => useMySessions(), { wrapper }).result;
}

afterEach(cleanup);

describe('the member\'s sessions', () => {
  it('reads each session and its month, with money in paise', async () => {
    const result = renderSessions([{
      visit_id: 'v1', opened_at: '2026-10-27T15:40:00+00:00', closed_at: '2026-10-27T22:10:00+00:00', table_name: 'Table 2',
      small_blind_paise: 10000, big_blind_paise: 20000, other_tables: 1, played_seconds: 23400, buy_in_paise: 2000000, bonus_paise: 0,
      cash_out_paise: 4650000, tds_paise: 0, paid_paise: 4650000, net_paise: 2650000, receipt: 'A1B2C3D4', month: '2026-10-01',
      month_sessions: 3, month_played_seconds: 45600, month_net_paise: -1000000,
    }]);
    await waitFor(() => expect(result.current.data).toEqual([{
      visitId: 'v1', openedAt: '2026-10-27T15:40:00+00:00', closedAt: '2026-10-27T22:10:00+00:00', tableName: 'Table 2',
      smallBlind: 10000n, bigBlind: 20000n, otherTables: 1, playedSeconds: 23400, buyIn: 2000000n, bonus: 0n, cashOut: 4650000n, tds: 0n,
      paid: 4650000n, net: 2650000n, receipt: 'A1B2C3D4', month: '2026-10-01', monthSessions: 3, monthPlayedSeconds: 45600, monthNet: -1000000n,
    }]));
  });

  it('is empty without any', async () => {
    const result = renderSessions([]);
    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});
