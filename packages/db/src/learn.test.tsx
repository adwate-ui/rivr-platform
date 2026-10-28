import { createOfflineQueue } from '@rivr/offline';
import { createClient } from '@supabase/supabase-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import {
  sendLearnProgress, useCompleteLearnSession, useLearnAnswers, useLearnCards, useLearnEncoding, useLearnLibrary, useLearnProgressQueue,
  type LearnProgress,
} from './learn.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

function clientFor(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? [], { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor('00000000-0000-4000-8000-000000000213'), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client, calls };
}

const ANSWER = { id: 'a1', sessionId: 's1', sourceKey: 'src_example', principleId: 'p_open', answeredAt: '2026-11-20T10:00:00Z', attempt: { correct: true } };
const CARD = { sourceKey: 'src_example', cardKey: 'p_open#1', state: { reps: 1 }, dueAt: '2026-11-21T10:00:00Z' };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Learn progress', () => {
  it('sends answers and cards as the server keeps them, and says which refusals are for good', async () => {
    const sent = clientFor({ '/rpc/sync_learn_progress': { body: 1 } });
    expect(await sendLearnProgress(sent.client, { answers: [ANSWER], cards: [CARD] })).toBe('sent');
    expect(sent.calls[0]?.body).toEqual({
      p_attempts: [{ id: 'a1', session_id: 's1', source_key: 'src_example', principle_id: 'p_open', answered_at: '2026-11-20T10:00:00Z', attempt: { correct: true } }],
      p_cards: [{ source_key: 'src_example', card_key: 'p_open#1', state: { reps: 1 }, due_at: '2026-11-21T10:00:00Z' }],
    });
    const refused = clientFor({ '/rpc/sync_learn_progress': { status: 400, body: { code: '22023', message: 'no' } } });
    expect(await sendLearnProgress(refused.client, { answers: [ANSWER], cards: [] })).toBe('rejected');
    const frozen = clientFor({ '/rpc/sync_learn_progress': { status: 400, body: { code: 'RVFRZ', message: 'frozen' } } });
    expect(await sendLearnProgress(frozen.client, { answers: [ANSWER], cards: [] })).toBe('retry');
  });

  it('reads the member\'s cards, and completes a session with its points', async () => {
    const { client, calls } = clientFor({
      '/rest/v1/learn_card': { body: [{ source_key: 'src_example', card_key: 'p_open#1', state: { reps: 2 }, due_at: '2026-11-22T10:00:00Z' }] },
      '/rpc/complete_learn_session': { body: 60 },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => ({ cards: useLearnCards('src_example'), complete: useCompleteLearnSession() }), { wrapper });
    await waitFor(() => expect(result.current.cards.data).toEqual([{ ...CARD, state: { reps: 2 }, dueAt: '2026-11-22T10:00:00Z' }]));
    let completed: unknown;
    await act(async () => { completed = await result.current.complete.mutateAsync({ sessionId: 's1', principles: ['p_open'] }); });
    expect(completed).toEqual({ ok: true, value: 60 });
    expect(calls.find((call) => call.url.includes('/rpc/complete_learn_session'))?.body).toEqual({ p_session_id: 's1', p_principles: ['p_open'] });
  });
});

describe('the Learn progress queue', () => {
  it('sends what it kept through a reload as soon as the app opens, and completes the session it carries', async () => {
    const indexedDB = new IDBFactory();
    vi.stubGlobal('indexedDB', indexedDB);
    // Before the reload: an answer and its session's completion kept on the phone, offline.
    const before = createOfflineQueue<LearnProgress>({ name: 'learn-progress', indexedDB, send: async () => 'retry' });
    await before.enqueue({ answers: [ANSWER], cards: [CARD], completed: { sessionId: 's1', principles: ['p_open'] } }, 'a1');
    await before.flush();
    before.close();
    const { client, calls } = clientFor({ '/rpc/sync_learn_progress': { body: 1 }, '/rpc/complete_learn_session': { body: 35 } });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const { result } = renderHook(() => useLearnProgressQueue(), { wrapper });
    await waitFor(() => expect(calls.map((call) => call.url.split('/rpc/')[1])).toEqual(['sync_learn_progress', 'complete_learn_session']));
    expect(calls[1]?.body).toEqual({ p_session_id: 's1', p_principles: ['p_open'] });
    await waitFor(async () => expect(await result.current.pendingCount()).toBe(0));
  });
});

describe('the Learn library', () => {
  it('reads the sources the member has, a source\'s encoding, and their answers in it', async () => {
    const { client, calls } = clientFor({
      '/rest/v1/learn_source': { body: [{ source_key: 'src_book', title: 'The Book', author: null, venue_id: 'v1' }] },
      '/storage/v1/object/learn-sources/v1/src_book.json': { body: { source: { id: 'src_book' } } },
      '/rest/v1/learn_attempt': { body: [{ attempt: { correct: true } }] },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client}>{children}</RivrDataProvider>;
    const source = { sourceKey: 'src_book', title: 'The Book', author: null, venueId: 'v1' };
    const { result } = renderHook(() => ({ library: useLearnLibrary(), encoding: useLearnEncoding(source), answers: useLearnAnswers('src_book') }), { wrapper });
    await waitFor(() => expect(result.current.library.data).toEqual([source]));
    await waitFor(() => expect(JSON.parse(result.current.encoding.data ?? '{}')).toEqual({ source: { id: 'src_book' } }));
    await waitFor(() => expect(result.current.answers.data).toEqual({ total: 1, latest: [{ correct: true }] }));
    expect(calls.some((call) => call.url.includes('learn_attempt') && call.url.includes('source_key=eq.src_book') && call.url.includes('order=answered_at.desc'))).toBe(true);
  });
});
