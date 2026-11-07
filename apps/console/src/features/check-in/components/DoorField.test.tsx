import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DoorField } from './DoorField.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CARD = 'RIVR-58-1730612400-a3f9c2d1e4b5f6a7b8c9d0e1';

/** A member as the search finds them. */
const member = (id: string, name: string, number: number) => ({
  member_id: id, member_number: number, full_name: name, phone: '+919000000200', tier_name: 'Black card', visits: 3, last_visit_at: null,
});

/** The front desk signed in; a fake API whose search finds `found` and whose check-ins and check-outs open and close a visit. */
function renderDoor(found: unknown[] = []) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: { rpc: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = /\/rpc\/(\w+)/.exec(url)?.[1];
    if (rpc === undefined) return Response.json([]);
    sent.push({ rpc, body: JSON.parse(String(init?.body ?? '{}')) });
    if (rpc === 'member_search') return Response.json(found);
    return Response.json('visit-1');
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DoorField venueId="v1" />
    </RivrDataProvider>,
  );
  return sent;
}

const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Card, mobile, number or name' });
const type = (value: string) => fireEvent.change(field(), { target: { value } });

describe('the door field', () => {
  it('checks a member in by mobile number, and the field is empty again', async () => {
    const sent = renderDoor();
    type('9876543210');
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    expect(field().value).toBe('');
    expect(sent.find((call) => call.rpc === 'check_in_by_phone')?.body).toEqual({ p_venue_id: 'v1', p_phone: '+919876543210' });
  });

  it('keeps "Checked in." when a second tap lands on the emptied field', async () => {
    renderDoor();
    type('9876543210');
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Checked in.')).toBeDefined();
  });

  it('takes "Checked in." away when the next entry is unusable', async () => {
    renderDoor();
    type('9876543210');
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    type('k');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(await screen.findByText('Scan the card, or type a mobile, member number or name.')).toBeDefined();
    expect(screen.queryByText('Checked in.')).toBeNull();
  });

  it('checks a member in by the card the scanner reads, on Enter', async () => {
    const sent = renderDoor();
    type(CARD);
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(await screen.findByText('Checked in.')).toBeDefined();
    expect(sent.find((call) => call.rpc === 'check_in_by_card')?.body).toEqual({ p_venue_id: 'v1', p_code: CARD });
  });

  it('checks in the one member a name finds, on Enter', async () => {
    const sent = renderDoor([member('m1', 'Kabir Sethi', 41)]);
    type('Kabir');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(await screen.findByText('Checked in.')).toBeDefined();
    expect(sent.find((call) => call.rpc === 'check_in')?.body).toEqual({ p_venue_id: 'v1', p_member_id: 'm1' });
  });

  it('lists every member a name finds when there are several, each to check in', async () => {
    const sent = renderDoor([member('m1', 'Kabir Sethi', 41), member('m2', 'Kabir Anand', 77)]);
    type('Kabir');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(await screen.findByText('More than one match. Pick one below.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check in Kabir Anand' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    expect(sent.find((call) => call.rpc === 'check_in')?.body).toEqual({ p_venue_id: 'v1', p_member_id: 'm2' });
  });

  it('says so when no member matches', async () => {
    renderDoor([]);
    type('Zara');
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(await screen.findByText('No member matches. Check the spelling or the number.')).toBeDefined();
  });

  it('checks a member out by mobile number', async () => {
    const sent = renderDoor();
    type('9876543210');
    fireEvent.click(screen.getByRole('button', { name: 'Check out' }));
    expect(await screen.findByText('Checked out.')).toBeDefined();
    await waitFor(() => expect(sent.some((call) => call.rpc === 'check_out_by_phone')).toBe(true));
  });
});
