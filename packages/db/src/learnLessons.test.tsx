import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useCompleteLearnLesson, useLearnLessons } from './learn.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const MIRA = '00000000-0000-4000-8000-000000000630';

/** A fake API: the lessons table answers with its rows, the function with 204 or a refusal. */
function renderLessons(status = 204) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/rest/v1/rpc/')) return status === 204 ? new Response(null, { status }) : Response.json({ code: '42501', message: 'no' }, { status });
    return Response.json([{ unit_id: 'unit_rh_flop', correct: 4, asked: 5, completed_at: '2026-10-28T10:00:00+00:00' }]);
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(MIRA), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
  const { result } = renderHook(() => ({ lessons: useLearnLessons('src_read_hands'), complete: useCompleteLearnLesson('src_read_hands') }), { wrapper });
  return { result, calls };
}

afterEach(cleanup);

describe('lessons', () => {
  it('gives the member the lessons of a book they have finished, with their results', async () => {
    const { result, calls } = renderLessons();
    await waitFor(() => expect(result.current.lessons.data).toEqual([{ unitId: 'unit_rh_flop', correct: 4, asked: 5, completedAt: '2026-10-28T10:00:00+00:00' }]));
    expect(calls[0]?.url).toContain('source_key=eq.src_read_hands');
  });

  it('keeps a finished lesson and its result for the book', async () => {
    const { result, calls } = renderLessons();
    expect(await act(() => result.current.complete.mutateAsync({ unitId: 'unit_rh_flop', correct: 4, asked: 5 }))).toEqual({ ok: true, value: null });
    expect(calls.find((call) => call.url.includes('/rpc/complete_learn_lesson'))?.body)
      .toEqual({ p_source_key: 'src_read_hands', p_unit_id: 'unit_rh_flop', p_correct: 4, p_asked: 5 });
  });

  it('says why a lesson was not kept', async () => {
    const { result } = renderLessons(403);
    expect((await act(() => result.current.complete.mutateAsync({ unitId: 'unit_rh_flop', correct: 0, asked: 0 }))).ok).toBe(false);
  });
});
