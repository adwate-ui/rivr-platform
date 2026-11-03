import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddPlaceForm } from './AddPlaceForm.tsx';

beforeEach(() => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The form over a fake API: `answer` for add_to_waitlist, and the bodies it was sent. */
function renderForm(answer: () => Promise<Response> | Response) {
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/add_to_waitlist')) return Response.json([]);
    sent.push(JSON.parse(String(init?.body)));
    return answer();
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console"><AddPlaceForm venueId="v1" table={{ id: 't1', name: 'Table 1' }} /></ToastProvider>
    </RivrDataProvider>,
  );
  return { sent, field: screen.getByRole('textbox', { name: 'Add: mobile or member no.' }), add: screen.getByRole('button', { name: 'Add' }) };
}

describe('adding a member to a table’s list (console v3)', () => {
  it('stops an empty number at the field, before any call', async () => {
    const { sent, add } = renderForm(() => Response.json('e1'));
    fireEvent.click(add);
    expect(await screen.findByText('Enter a mobile or member number.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('adds by membership number, and says so', async () => {
    const { sent, field, add } = renderForm(() => Response.json('e1'));
    fireEvent.change(field, { target: { value: '63' } });
    fireEvent.click(add);
    expect(await screen.findByText('Added to Table 1')).toBeDefined();
    expect(sent).toEqual([{ p_table_id: 't1', p_phone: '', p_member_number: 63, p_idempotency_key: expect.any(String) }]);
  });

  it('adds by mobile number when Enter is pressed in the field', async () => {
    const { sent, field } = renderForm(() => Response.json('e1'));
    fireEvent.change(field, { target: { value: '9876543210' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await waitFor(() => expect(sent).toEqual([{ p_table_id: 't1', p_phone: '+919876543210', p_idempotency_key: expect.any(String) }]));
  });

  it('says when nobody has the number', async () => {
    const { field, add } = renderForm(() => Response.json({ code: 'RVNOM', message: 'No member has that number' }, { status: 400 }));
    fireEvent.change(field, { target: { value: '9876543210' } });
    fireEvent.click(add);
    expect(await screen.findByText('No member has that number. Sign them up first.')).toBeDefined();
  });

  it('is busy from the first tap until the answer comes, so a second tap sends nothing more', async () => {
    // The answer never comes, as on a slow network.
    const { sent, field, add } = renderForm(() => new Promise<Response>(() => undefined));
    fireEvent.change(field, { target: { value: '9876543210' } });
    fireEvent.click(add);
    await waitFor(() => expect(add.getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(add);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toHaveLength(1);
  });
});
