import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type Computer } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComputerRow } from './ComputerRow.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CAGE: Computer = { deviceId: 'd1', kind: 'cage', name: 'Cage PC', isEnrolled: true };

/** Vikram, a super admin, signed in, and a fake API that answers the revoke with `reply`. */
function renderRow(reply: () => Response) {
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
    if (url.includes('/rest/v1/device') && init?.method === 'PATCH') {
      sent.push(JSON.parse(String(init.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><ComputerRow venueId="v1" computer={CAGE} isThisOne={false} /></RivrDataProvider>);
  return sent;
}

describe('ComputerRow', () => {
  it('revokes a computer with the reason, after asking for one', async () => {
    const sent = renderRow(() => new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Cage PC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('Say why, in a few words.')).toBeTruthy();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Why it is revoked' }), { target: { value: ' Stolen from the cage ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(sent).toEqual([{ revoked_at: 'now', revoked_reason: 'Stolen from the cage' }]));
  });

  it('closes without revoking on Cancel', () => {
    const sent = renderRow(() => new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Cage PC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Why it is revoked' })).toBeNull();
    expect(sent).toEqual([]);
  });
});
