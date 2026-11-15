import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddStaffSheet } from './AddStaffForm.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A manager signed in, the panel open, and what the fake API was sent to add. */
function renderSheet() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'POST' && !url.includes('/auth/')) sent.push(String(init.body));
    return Response.json([]);
  });
  const onClose = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console"><AddStaffSheet venueId="v1" grantable={['cashier', 'host']} onClose={onClose} /></ToastProvider>
    </RivrDataProvider>,
  );
  return { sent, onClose, panel: within(screen.getByRole('dialog', { name: 'New staff member' })) };
}

describe('adding a staff member, in the panel at the side (redesign RD-38)', () => {
  it('has the same fields as before, the roles the manager may give, and Cancel beside Add at its foot', () => {
    const { panel, onClose } = renderSheet();
    for (const name of ['Full name', 'Job title', 'Mobile number']) expect(panel.getByRole('textbox', { name })).toBeDefined();
    expect(within(panel.getByRole('radiogroup', { name: 'Role' })).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Cashier', 'Host']);
    fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says what is missing under each field, sends nothing and stays open', async () => {
    const { panel, sent, onClose } = renderSheet();
    fireEvent.click(panel.getByRole('button', { name: 'Add staff member' }));
    await waitFor(() => expect(panel.getByRole('textbox', { name: 'Full name' }).getAttribute('aria-invalid')).toBe('true'));
    expect(sent).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('adds them, says so and closes', async () => {
    const { panel, sent, onClose } = renderSheet();
    fireEvent.change(panel.getByRole('textbox', { name: 'Full name' }), { target: { value: 'Naina Kapoor' } });
    fireEvent.change(panel.getByRole('textbox', { name: 'Job title' }), { target: { value: 'Front desk' } });
    fireEvent.click(panel.getByRole('radio', { name: 'Host' }));
    fireEvent.change(panel.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876500001' } });
    fireEvent.click(panel.getByRole('button', { name: 'Add staff member' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('Naina Kapoor');
    expect(await screen.findByText('Naina Kapoor is added.')).toBeDefined();
  });
});
