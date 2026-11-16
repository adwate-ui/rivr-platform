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


/** A member as the search finds them. */
const member = (id: string, name: string, number: number) => ({
  member_id: id, member_number: number, full_name: name, phone: '+919000000200', tier_name: 'Black card', visits: 3, last_visit_at: null,
});

/** A member at the club today, as today's players reads them: in at two, and out at `out` if given. */
const today = (id: string, status: string, times: { in?: string | null; out?: string | null } = {}) => ({
  member_id: id, full_name: 'Kabir Sethi', member_number: 41, status, checked_in_at: times.in === undefined ? '2026-11-16T14:00:00Z' : times.in,
  checked_out_at: times.out ?? null, waiting_seconds: 0, tables: [],
});

/**
 * The front desk signed in; a fake API whose search finds `found`, whose players today are `todays`, and whose check-ins and
 * check-outs open and close a visit.
 */
function renderDoor(found: unknown[] = [], todays: unknown[] = []) {
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
    if (rpc === 'todays_players') return Response.json(todays);
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

const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Name, mobile or member number' });

/** A match's button once it may be pressed: held until who is in the club is known. */
async function pressable(name: string) {
  return waitFor(() => {
    const button = screen.getByRole('button', { name });
    expect(button).toHaveProperty('disabled', false);
    return button;
  });
}
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
    expect(await screen.findByText('Type a name, mobile or member number.')).toBeDefined();
    expect(screen.queryByText('Checked in.')).toBeNull();
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
    fireEvent.click(await pressable('Check in Kabir Anand'));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    expect(sent.find((call) => call.rpc === 'check_in')?.body).toEqual({ p_venue_id: 'v1', p_member_id: 'm2' });
  });

  it('lists the members a name matches as it is typed, each with the action that fits them (owner, 16 Nov)', async () => {
    const sent = renderDoor([member('m1', 'Kabir Sethi', 41), member('m2', 'Kabir Anand', 77)], [today('m1', 'playing')]);
    type('Kab');
    // Kabir Sethi is in the club: Check out. Kabir Anand is not: Check in. Nothing pressed yet.
    fireEvent.click(await pressable('Check out Kabir Sethi'));
    expect(await screen.findByText('Checked out.')).toBeDefined();
    expect(sent.find((call) => call.rpc === 'check_out')?.body).toEqual({ p_venue_id: 'v1', p_member_id: 'm1' });
    expect(sent.some((call) => call.rpc === 'check_in')).toBe(false);
  });

  it('offers Check in to a member who already left the club today', async () => {
    renderDoor([member('m1', 'Kabir Sethi', 41)], [today('m1', 'left', { out: '2026-11-16T18:00:00Z' })]);
    type('Kabir');
    expect(await screen.findByRole('button', { name: 'Check in Kabir Sethi' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Check out Kabir Sethi' })).toBeNull();
  });

  it('offers Check in to one who joined a list from the app but is not in yet', async () => {
    renderDoor([member('m1', 'Kabir Sethi', 41)], [today('m1', 'waiting', { in: null })]);
    type('Kabir');
    expect(await screen.findByRole('button', { name: 'Check in Kabir Sethi' })).toBeDefined();
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
