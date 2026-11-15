import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from './router.tsx';

// A screen loaded on first use takes longer than the default second on a busy machine.
const LAZY_SCREEN = { timeout: 5000 };

beforeEach(() => {
  localStorage.setItem('rivr.cookies', JSON.stringify({ maps: false, analytics: false }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Opens the app at `path` as main.tsx does, with `onFailure` in place of error reporting's. */
function renderAt(path: string) {
  const onFailure = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} onFailure={onFailure}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))} />
    </RivrDataProvider>,
  );
  return () => onFailure.mock.calls.map(([code]: unknown[]) => code);
}

describe('failures the screens handle themselves are reported (the trial run of 13 Nov)', () => {
  it('Sign in: a code request Auth could not take, by its code', async () => {
    const reported = renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }), { target: { value: '98765 43210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Sign-in is down. Try again shortly.')).toBeDefined();
    expect(reported()).toContain('refused:unavailable');
    expect(JSON.stringify(reported())).not.toContain('98765');
  });

  it('Sign up: the fields the form\'s own checks stopped at, and nothing typed in them', async () => {
    const user = { id: '00000000-0000-4000-8000-000000000202', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => Response.json(String(input instanceof Request ? input.url : input).includes('/rest/v1/member') ? null : []));
    const reported = renderAt('/sign-up');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Full name, as on Aadhaar' }, LAZY_SCREEN), { target: { value: 'Asha Verma 2' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' }).getAttribute('aria-busy')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(reported()).toContain('sign_up_invalid:fullName,city,occupation'));
    expect(JSON.stringify(reported())).not.toContain('Asha');
  });
});
