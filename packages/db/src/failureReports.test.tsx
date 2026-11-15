import { err, ok } from '@rivr/contracts/result';
import { createClient } from '@supabase/supabase-js';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { RivrDataProvider, useReportFailure } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
  auth: { storage: sessionStorageFor(null), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
});

/** A screen with a read that fails, a change the server refuses, one it accepts, and a failure of its own to report. */
function Screen() {
  const reportFailure = useReportFailure();
  const read = useQuery({ queryKey: ['user', 'u1', 'member'], retry: false, queryFn: () => Promise.reject(Object.assign(new Error('denied for +91 98765 43210'), { code: '42501' })) });
  const refused = useMutation({ mutationFn: () => Promise.resolve(err('not_live')) });
  const accepted = useMutation({ mutationFn: () => Promise.resolve(ok(null)) });
  return (
    <>
      <p>{read.isError ? 'read failed' : 'reading'}</p>
      <button type="button" onClick={() => refused.mutate()}>refuse</button>
      <button type="button" onClick={() => accepted.mutate()}>accept</button>
      <button type="button" onClick={() => reportFailure('camera:blocked')}>camera</button>
    </>
  );
}

afterEach(cleanup);

describe('RivrDataProvider onFailure', () => {
  it('is told of a read that failed and a change the server refused by their codes, and of what a screen reports itself', async () => {
    const onFailure = vi.fn();
    render(<RivrDataProvider client={client} onFailure={onFailure}><Screen /></RivrDataProvider>);
    await screen.findByText('read failed');
    fireEvent.click(screen.getByRole('button', { name: 'refuse' }));
    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'camera' }));
    await waitFor(() => expect(onFailure.mock.calls.map(([code]: unknown[]) => code).sort()).toEqual(['camera:blocked', 'read:member:42x501', 'refused:not_live']));
  });

  it('reports nothing, and breaks nothing, in an app that gives no onFailure', async () => {
    render(<RivrDataProvider client={client}><Screen /></RivrDataProvider>);
    await screen.findByText('read failed');
    fireEvent.click(screen.getByRole('button', { name: 'camera' }));
    expect(screen.getByRole('button', { name: 'refuse' })).toBeDefined();
  });
});
