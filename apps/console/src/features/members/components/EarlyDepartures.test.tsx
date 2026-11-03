import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarlyDepartures } from './EarlyDepartures.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const STANDING = {
  early_departure_id: 'e1', created_at: '2026-11-15T12:00:00Z', shortfall_seconds: 3600, reason: 'Unwell', staff_name: 'Harish Kumar',
  withdrawn_at: null, withdrawn_reason: null, withdrawn_by: null,
};
const WITHDRAWN = {
  ...STANDING, early_departure_id: 'e0', created_at: '2026-11-08T12:00:00Z', withdrawn_at: '2026-11-09T10:00:00Z',
  withdrawn_reason: 'Recorded against the wrong member', withdrawn_by: 'Vikram Rao',
};

/** The list for a staff member, answered by `answer` per call; every call kept with its path and body. */
function renderList(canWithdraw: boolean, answer: (path: string) => Response) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input instanceof Request ? input.url : input);
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return answer(path);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <EarlyDepartures venueId="v1" memberId="m1" canWithdraw={canWithdraw} />
    </RivrDataProvider>,
  );
  return calls;
}

describe('EarlyDepartures', () => {
  it('says the list did not load, with Try again, which asks again (F1-24)', async () => {
    const calls = renderList(false, () => Response.json({ message: 'down' }, { status: 500 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }, { timeout: 5000 }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it('lets a super admin withdraw one still standing, with a reason in words, and shows one withdrawn with who and why', async () => {
    const calls = renderList(true, (path) => Response.json(path.includes('withdraw_early_departure') ? null : [STANDING, WITHDRAWN]));
    expect(await screen.findByText('Withdrawn 9 Nov 2026 by Vikram Rao: Recorded against the wrong member', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Withdraw the early departure of 8 Nov 2026' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the early departure of 15 Nov 2026' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Why the early departure of 15 Nov 2026 is withdrawn' }), { target: { value: 'Wrong seat chosen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw it' }));
    await vi.waitFor(() => expect(calls.find((call) => call.path.includes('withdraw_early_departure'))?.body)
      .toEqual({ p_early_departure_id: 'e1', p_reason: 'Wrong seat chosen' }));
  });

  it('says why a withdrawal is refused', async () => {
    renderList(true, (path) => (path.includes('withdraw_early_departure')
      ? Response.json({ code: '22023', message: 'bad' }, { status: 400 }) : Response.json([STANDING])));
    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw the early departure of 15 Nov 2026' }, { timeout: 5000 }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Why the early departure of 15 Nov 2026 is withdrawn' }), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw it' }));
    expect(await screen.findByText('Give the reason in words, three characters or more.')).toBeDefined();
  });

  it('offers no Withdraw to anyone but a super admin', async () => {
    renderList(false, () => Response.json([STANDING]));
    expect(await screen.findByText(/Unwell · let go by Harish Kumar/, {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Withdraw/ })).toBeNull();
  });
});
