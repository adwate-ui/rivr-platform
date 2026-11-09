import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardScreen } from './CardScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const KAVYA = '00000000-0000-4000-8000-000000000290';
const CARD = { member_number: 1024, full_name: 'Kavya Rao', tier_name: 'Member', code: 'card-1.1792740800.mac', ms_left: 60_000, photo_path: null };
const SELFIE = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000290/selfie.jpg';

/** Kavya signed in, and my_membership_card answering with her card, a failure, or never; `answer` changes it. */
function renderCard(first: 'card' | 'fails' | 'never', card: object = CARD, kept?: object) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: KAVYA, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let answer = first;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    if (String(input instanceof Request ? input.url : input).includes('/functions/v1/kyc-image-url')) {
      return Response.json({ signedPath: `/object/sign/kyc/${SELFIE}?token=one-minute` });
    }
    if (answer === 'never') return new Promise<Response>(() => undefined);
    return answer === 'fails' ? Response.json({ message: 'down' }, { status: 503 }) : Response.json([card]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (kept !== undefined) cache.setQueryData(['user', KAVYA, 'membership-card'], kept);
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <CardScreen />
    </RivrDataProvider>,
  );
  return { answer: (next: 'card' | 'fails') => { answer = next; } };
}

/** How much of the bar under the QR is left, 1 to 0. */
function barLeft(): number {
  const transform = document.querySelector<HTMLElement>('[data-progress-fill]')?.style.transform ?? '';
  return Number(transform.replace('scaleX(', '').replace(')', ''));
}

describe('Membership card', () => {
  it('says to give the number at the door when the connection drops, rather than Loading for ever', async () => {
    onlineManager.setOnline(false);
    try {
      renderCard('never');
      expect(await screen.findByText('Give your number at the door.')).toBeDefined();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('says so at once when the app opens with no connection, before any read has paused', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      renderCard('never');
      expect(screen.getByRole('heading', { name: 'No connection' })).toBeDefined();
      expect(screen.getByText('Give your number at the door.')).toBeDefined();
      expect(screen.queryByText('Your number')).toBeNull();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('gives the number the phone kept, opened with no connection (F-053)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      renderCard('never', CARD, { memberNumber: '1024', fullName: 'Kavya Rao', tierName: 'Member', code: 'old', msLeft: 0, photoPath: null });
      expect(await screen.findByRole('heading', { name: 'No connection' }, { timeout: 5000 })).toBeDefined();
      // The first paint comes before the stored session is read: the number follows once it is.
      expect(await screen.findByText('Your number', {}, { timeout: 5000 })).toBeDefined();
      // Large and at full contrast, in the card's figure style, with nothing after it to read past.
      expect(screen.getByText('1024').className).toContain('text-56');
      expect(screen.getByText('1024').className).not.toContain('muted');
      expect(screen.getByText('Give your number at the door.')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('says it is loading until the card comes', async () => {
    renderCard('never');
    expect(await screen.findByRole('status', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Card' })).toBeDefined();
  });

  it('Card: shows the member, their tier and number, and the QR holding their door code, with no caption', async () => {
    renderCard('card');
    expect(await screen.findByText('Kavya Rao', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Member')).toBeDefined();
    expect(screen.getByText('No. 1024')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Your door code' }).getAttribute('data-value')).toBe('card-1.1792740800.mac');
    // No caption under the card (decision 0320).
    expect(screen.queryByText('Show at the door.')).toBeNull();
  });

  it('shows no photo for a member without a verified selfie', async () => {
    renderCard('card');
    expect(await screen.findByText('Kavya Rao', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('img', { name: 'Your photo' })).toBeNull();
  });

  it('shows the member\u2019s verified selfie on the card, by a signed one-minute link (decision 0300)', async () => {
    renderCard('card', { ...CARD, photo_path: SELFIE });
    const photo = await screen.findByRole('img', { name: 'Your photo' }, { timeout: 5000 });
    expect(photo.getAttribute('src')).toContain(`/object/sign/kyc/${SELFIE}?token=one-minute`);
  });

  it('runs a bar down to the next code, so the desk can see the code is live (F-182)', async () => {
    renderCard('card', { ...CARD, ms_left: 10_000 });
    expect(await screen.findByText('Kavya Rao', {}, { timeout: 5000 })).toBeDefined();
    await waitFor(() => expect(barLeft()).toBeLessThan(1), { timeout: 3000 });
    const earlier = barLeft();
    await waitFor(() => expect(barLeft()).toBeLessThan(earlier), { timeout: 3000 });
  });

  it('keeps the brightness hint for the card itself: opening Card offline does not use it up (F-182)', async () => {
    sessionStorage.clear();
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      renderCard('never');
      expect(screen.getByText('Give your number at the door.')).toBeDefined();
      expect(screen.queryByText('Turn your brightness up.')).toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
    cleanup();
    renderCard('card');
    expect(await screen.findByText('Turn your brightness up.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('says once a session to turn the brightness up (F-182)', async () => {
    sessionStorage.clear();
    renderCard('card');
    expect(await screen.findByText('Turn your brightness up.', {}, { timeout: 5000 })).toBeDefined();
    cleanup();
    renderCard('card');
    expect(await screen.findByText('Kavya Rao', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByText('Turn your brightness up.')).toBeNull();
  });

  it('says it could not load, and loads on Try again', async () => {
    const api = renderCard('fails');
    const retry = await screen.findByRole('button', { name: 'Try again' }, { timeout: 5000 });
    api.answer('card');
    fireEvent.click(retry);
    expect(await screen.findByText('Kavya Rao')).toBeDefined();
  });
});
