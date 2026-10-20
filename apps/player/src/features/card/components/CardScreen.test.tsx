import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardScreen } from './CardScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const KAVYA = '00000000-0000-4000-8000-000000000290';
const CARD = { member_number: 1024, full_name: 'Kavya Rao', tier_name: 'Member', code: 'card-1.1792740800.mac', ms_left: 60_000 };

/** Kavya signed in, and my_membership_card answering with her card, a failure, or never; `answer` changes it. */
function renderCard(first: 'card' | 'fails' | 'never') {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: KAVYA, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let answer = first;
  vi.stubGlobal('fetch', async () => {
    if (answer === 'never') return new Promise<Response>(() => undefined);
    return answer === 'fails' ? Response.json({ message: 'down' }, { status: 503 }) : Response.json([CARD]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <CardScreen />
    </RivrDataProvider>,
  );
  return { answer: (next: 'card' | 'fails') => { answer = next; } };
}

describe('Membership card', () => {
  it('says it is loading until the card comes', async () => {
    renderCard('never');
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Membership card' })).toBeDefined();
  });

  it('shows the member, their tier and number, and the QR holding their door code', async () => {
    renderCard('card');
    expect(await screen.findByText('Kavya Rao', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Member')).toBeDefined();
    expect(screen.getByText('No. 1024')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Your door code' }).getAttribute('data-value')).toBe('card-1.1792740800.mac');
    expect(screen.getByText('Show this at the door. The code changes every few seconds.')).toBeDefined();
  });

  it('says it could not load, and loads on Try again', async () => {
    const api = renderCard('fails');
    const retry = await screen.findByRole('button', { name: 'Try again' }, { timeout: 5000 });
    api.answer('card');
    fireEvent.click(retry);
    expect(await screen.findByText('Kavya Rao')).toBeDefined();
  });
});
