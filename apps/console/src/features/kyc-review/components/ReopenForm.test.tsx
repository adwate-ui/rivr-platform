import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReopenForm } from './ReopenForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Vikram, a super admin, signed in, and a fake API that answers the reopening with `reply`. */
function renderForm(reply: () => Response) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/reopen_kyc_check')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><ReopenForm venueId="v1" memberId="m1" fullName="Naina Kapoor" /></RivrDataProvider>);
  return sent;
}

describe('ReopenForm', () => {
  it('reopens a refused check done in person, with the reason', async () => {
    const sent = renderForm(() => new Response(null, { status: 204 }));
    fireEvent.change(screen.getByLabelText('Reason for reopening Naina Kapoor\'s check'), { target: { value: ' The date of birth was typed wrong ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the check' }));
    await waitFor(() => expect(sent).toEqual([{ p_member_id: 'm1', p_reason: 'The date of birth was typed wrong' }]));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says why when the database refuses', async () => {
    renderForm(() => Response.json({ code: '42501', message: 'Only a super admin reopens a check' }, { status: 403 }));
    fireEvent.change(screen.getByLabelText('Reason for reopening Naina Kapoor\'s check'), { target: { value: 'Typed wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the check' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Your role does not allow this/);
  });
});
