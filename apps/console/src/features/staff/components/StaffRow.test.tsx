import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type StaffMember } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffRow } from './StaffRow.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const AYESHA: StaffMember = {
  staffId: 's1', fullName: 'Ayesha Thomas', jobTitle: 'Floor supervisor', role: 'cashier', phone: '+919000000150', isActive: true, isMe: false,
};

/** Aditya, an admin, signed in, and a fake API that keeps every change sent to the staff table. */
function renderRow() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff') && init?.method === 'PATCH') {
      sent.push(JSON.parse(String(init.body)));
      return Response.json([{ id: 's1' }]);
    }
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <StaffRow venueId="v1" member={AYESHA} grantable={['cashier', 'host']} />
    </RivrDataProvider>,
  );
  return sent;
}

describe('StaffRow', () => {
  it('asks before a role picked on the row is saved, and saves it on Yes', async () => {
    const sent = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Host' }));
    expect(screen.getByText("Change Ayesha Thomas's role to Host?")).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, change it' }));
    await waitFor(() => expect(sent).toEqual([{ role: 'host' }]));
  });

  it('asks before the login is turned off, and Cancel leaves it on', () => {
    const sent = renderRow();
    const active = screen.getByRole('switch', { name: 'Active: Ayesha Thomas' });
    fireEvent.click(active);
    expect(screen.getByText("Turn off Ayesha Thomas's login?")).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText("Turn off Ayesha Thomas's login?")).toBeNull();
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(sent).toEqual([]);
  });
});
