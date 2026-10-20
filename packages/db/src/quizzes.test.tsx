import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider } from './provider.tsx';
import { useQuizAttempts, useQuizzes, useSubmitQuiz } from './quizzes.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const SIGNED_IN = '00000000-0000-4000-8000-000000000104';
const PRACTICE = '00000000-0000-4000-8000-000000000002';

/** A fake API: each path answers with its reply. */
function renderQuizzes(replies: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const path = Object.keys(replies).find((key) => url.includes(key));
    const reply = path ? replies[path] : undefined;
    return Response.json(reply?.body ?? null, { status: reply?.status ?? 200 });
  };
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch },
    auth: { storage: sessionStorageFor(SIGNED_IN), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // No retries, so a quiz that fails to parse shows as an error at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <RivrDataProvider client={client} queryClient={queryClient}>{children}</RivrDataProvider>;
  const { result } = renderHook(
    () => ({ quizzes: useQuizzes(PRACTICE), attempts: useQuizAttempts(PRACTICE), mine: useQuizAttempts(PRACTICE, 's1'), submit: useSubmitQuiz(PRACTICE) }),
    { wrapper },
  );
  return { result, calls };
}

const QUESTIONS = [{ prompt: 'Your down is over.', choices: ['Walk away', 'End the down on the tablet'] }];
const QUIZ = { id: 'q1', role: 'dealer', title: 'Dealer certification', pass_percent: 80, questions: QUESTIONS };
const ATTEMPT = {
  id: 'a1', quiz_id: 'q1', staff_id: 's1', correct_count: 5, question_count: 6, is_passed: true, created_at: '2026-10-20T10:00:00+00:00',
  staff: { full_name: 'Sana Qureshi' }, quiz: { title: 'Cashier certification' },
};
const EMPTY = { '/rest/v1/quiz_attempt': { body: [] }, '/rest/v1/quiz': { body: [] } };

afterEach(cleanup);

describe('Certification quizzes', () => {
  it('lists the quizzes with their questions, and the attempts with who took them, all or one person\'s', async () => {
    const { result, calls } = renderQuizzes({ '/rest/v1/quiz_attempt': { body: [ATTEMPT] }, '/rest/v1/quiz': { body: [QUIZ] } });
    await waitFor(() => expect(result.current.mine.isSuccess).toBe(true));
    expect(calls.filter((call) => call.url.includes('/rest/v1/quiz_attempt')).map((call) => call.url.includes('staff_id=eq.s1')).sort())
      .toEqual([false, true]);
    await waitFor(() => expect(result.current.quizzes.data).toEqual([
      { quizId: 'q1', role: 'dealer', title: 'Dealer certification', passPercent: 80, questions: QUESTIONS },
    ]));
    await waitFor(() => expect(result.current.attempts.data).toEqual([{
      attemptId: 'a1', quizId: 'q1', quizTitle: 'Cashier certification', staffId: 's1', staffName: 'Sana Qureshi',
      correctCount: 5, questionCount: 6, isPassed: true, takenAt: '2026-10-20T10:00:00+00:00',
    }]));
  });

  it('fails to load a quiz whose questions are not as expected, rather than show half of it', async () => {
    const { result } = renderQuizzes({ ...EMPTY, '/rest/v1/quiz': { body: [{ ...QUIZ, questions: [{ prompt: 'When?' }] }] } });
    await waitFor(() => expect(result.current.quizzes.isError).toBe(true));
  });

  it('hands in the answers and gives the mark, or why it was not recorded', async () => {
    const marked = renderQuizzes({ ...EMPTY, '/rpc/submit_quiz': { body: [{ correct_count: 5, question_count: 6, is_passed: true }] } });
    let outcome: unknown;
    await act(async () => { outcome = await marked.result.current.submit.mutateAsync({ quizId: 'q1', answers: [1, 0, 2, 1, 0, 1] }); });
    expect(outcome).toEqual({ ok: true, value: { correctCount: 5, questionCount: 6, isPassed: true } });
    expect(marked.calls.find((call) => call.url.includes('submit_quiz'))?.body).toEqual({ p_quiz_id: 'q1', p_answers: [1, 0, 2, 1, 0, 1] });
    cleanup();
    const frozen = renderQuizzes({ ...EMPTY, '/rpc/submit_quiz': { status: 400, body: { code: 'RVFRZ', message: 'venue_frozen' } } });
    await act(async () => { outcome = await frozen.result.current.submit.mutateAsync({ quizId: 'q1', answers: [1] }); });
    expect(outcome).toEqual({ ok: false, error: 'paused' });
  });
});
