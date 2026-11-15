import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useMyReferral } from './referral.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-0000000d0702';

/** A fake API that answers `my_referral` with the rows given. */
function renderReferral(rows: unknown[]) {
  const fetch: typeof globalThis.fetch = async () => Response.json(rows);
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return renderHook(() => useMyReferral(), { wrapper }).result;
}

afterEach(cleanup);

describe('the member\'s referral', () => {
  it('reads the referral code, how many were referred and the bonus each side gets now', async () => {
    const result = renderReferral([{ code: 'RIVR1042', referred: 2, bonus_paise: 100000 }]);
    await waitFor(() => expect(result.current.data).toEqual({ code: 'RIVR1042', referred: 2, bonus: 100000n }));
  });

  it('reads no bonus while the referral promotion is not running, and no code without referrals', async () => {
    const running = renderReferral([{ code: 'RIVR1042', referred: 0, bonus_paise: null }]);
    await waitFor(() => expect(running.current.data).toEqual({ code: 'RIVR1042', referred: 0, bonus: null }));
    cleanup();
    const without = renderReferral([]);
    await waitFor(() => expect(without.current.data).toBeNull());
  });
});
