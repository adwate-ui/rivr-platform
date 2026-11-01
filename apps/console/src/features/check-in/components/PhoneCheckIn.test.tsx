import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardCheckIn } from './CardCheckIn.tsx';
import { PhoneCheckIn } from './PhoneCheckIn.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The front desk signed in, and a fake API whose check-ins open a visit. */
function renderDoor() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return url.includes('/rpc/check_in_by_') ? Response.json('visit-1') : Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <PhoneCheckIn venueId="v1" />
      <CardCheckIn venueId="v1" />
    </RivrDataProvider>,
  );
}

describe('a check-in at the door', () => {
  it('says a check-in by number went through, as the field is empty again', async () => {
    renderDoor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Mobile number' }).value).toBe('');
  });

  it('keeps "Checked in." when a second tap lands on the emptied field, rather than asking for a number', async () => {
    renderDoor();
    fireEvent.change(screen.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText('Checked in.')).toBeDefined();
    expect(screen.queryByText('Enter a 10-digit mobile number.')).toBeNull();
  });

  it('takes "Checked in." away when the next number is refused, so it never stands for a check-in that failed', async () => {
    renderDoor();
    const phone = screen.getByRole('textbox', { name: 'Mobile number' });
    fireEvent.change(phone, { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Checked in.')).toBeDefined();
    fireEvent.change(phone, { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    expect(await screen.findByText('Enter a 10-digit mobile number.')).toBeDefined();
    expect(screen.queryByText('Checked in.')).toBeNull();
  });

  it('says a check-in by card went through', async () => {
    renderDoor();
    const card = screen.getByRole('textbox', { name: 'Membership card' });
    fireEvent.change(card, { target: { value: 'RIVR-1043-ABCDEF' } });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(await screen.findByText('Checked in.')).toBeDefined();
  });

  it('takes "Checked in." away when the next scan reads no code, so it never stands for a scan that failed', async () => {
    renderDoor();
    const card = screen.getByRole('textbox', { name: 'Membership card' });
    fireEvent.change(card, { target: { value: 'RIVR-1043-ABCDEF' } });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(await screen.findByText('Checked in.')).toBeDefined();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(await screen.findByText("No card code. Scan the member's card.")).toBeDefined();
    expect(screen.queryByText('Checked in.')).toBeNull();
  });
});
