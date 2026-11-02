import { createClient } from '@supabase/supabase-js';
import { focusManager } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useStaffQueueCounts } from './staffQueues.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const HOST = '00000000-0000-4000-8000-000000000108';

afterEach(cleanup);

/** The counts hook for venue v1, over a fake API answering each read with `reply`, and the bodies it was sent. */
function renderCounts(reply: unknown) {
  const asked: unknown[] = [];
  const fetch: typeof globalThis.fetch = async (_input, init) => {
    asked.push(JSON.parse(String(init?.body)));
    return Response.json(reply);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(HOST), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  return { asked, ...renderHook(() => useStaffQueueCounts('v1'), { wrapper }) };
}

describe('the staff queue counts (decision 0301)', () => {
  it('gives how many wait in each queue, by rail entry, from one call for the venue', async () => {
    const { asked, result } = renderCounts([{ queue: 'waitlist', waiting: 2 }, { queue: 'hostQueue', waiting: 5 }]);
    await waitFor(() => expect(result.current.data).toEqual({ waitlist: 2, hostQueue: 5 }));
    expect(asked).toEqual([{ p_venue_id: 'v1' }]);
  });

  it('keeps reading every ten seconds while the console sits in a background tab', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { asked, result } = renderCounts([{ queue: 'topUps', waiting: 1 }]);
      await waitFor(() => expect(result.current.data).toEqual({ topUps: 1 }));
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(10_000);
      await waitFor(() => expect(asked.length).toBe(2));
    } finally {
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });
});
