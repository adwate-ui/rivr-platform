import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddMemberForm } from './AddMemberForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('adding a member to a list by number', () => {
  it('stops an empty number at the field, before any call', async () => {
    const sent: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      sent.push(String(input instanceof Request ? input.url : input));
      return Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AddMemberForm venueId="v1" tableTypeId="t1" />
      </RivrDataProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add to the list' }));
    expect(await screen.findByText('Enter a 10-digit mobile number.')).toBeDefined();
    expect(sent.filter((url) => url.includes('add_to_waitlist'))).toEqual([]);
  });

  it('is busy from the first tap until the answer comes, so a second tap sends nothing more', async () => {
    const sent: string[] = [];
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      sent.push(url);
      // The answer never comes, as on a slow network.
      return url.includes('add_to_waitlist') ? new Promise<Response>(() => undefined) : Response.json([]);
    });
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AddMemberForm venueId="v1" tableTypeId="t1" />
      </RivrDataProvider>,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876543210' } });
    const add = screen.getByRole('button', { name: 'Add to the list' });
    fireEvent.click(add);
    await waitFor(() => expect(add.getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(add);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent.filter((url) => url.includes('add_to_waitlist'))).toHaveLength(1);
  });
});
