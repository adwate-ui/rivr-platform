import { createClient } from '@supabase/supabase-js';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useMyUsualFnbItems } from './fnbUsual.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

afterEach(cleanup);

describe('the member\'s usual order (decision 0320)', () => {
  it('reads the two items they order most, most first', async () => {
    const fetch: typeof globalThis.fetch = async () => Response.json([{ item_id: 'chai', times: 3 }, { item_id: 'sandwich', times: 2 }]);
    const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch },
      auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000202'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useMyUsualFnbItems(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(['chai', 'sandwich']));
  });
});
