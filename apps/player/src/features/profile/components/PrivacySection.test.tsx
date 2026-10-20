import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type Preferences } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrivacySection } from './PrivacySection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const KABIR = '00000000-0000-4000-8000-000000000202';

/** Kabir signed in; each save of his name on the TVs is kept, and answered with `status`. */
function renderPrivacy(preferences: Preferences, status = 204) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: KABIR, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const saved: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.includes('/rpc/set_my_name_on_tvs')) return Response.json([]);
    saved.push(JSON.parse(String(init?.body)));
    return status === 204 ? new Response(null, { status }) : Response.json({ message: 'down' }, { status });
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <PrivacySection preferences={preferences} />
    </RivrDataProvider>,
  );
  return saved;
}

const SHOWN: Preferences = { games: [], stake: null, notificationsOff: [], marketing: false, nameOnTvs: true };
const NAME = { name: 'Show my name on the club\'s TVs' };

// A member may hide their name on the TVs (task 326).
describe('Privacy: the name on the club\'s TVs', () => {
  it('is on until the member turns it off, and saves the choice', async () => {
    const saved = renderPrivacy(SHOWN);
    const choice = screen.getByRole('switch', NAME);
    expect(choice.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(choice);
    await waitFor(() => expect(saved).toEqual([{ p_is_on: false }]));
  });

  it('shows it off as saved, and turns it back on', async () => {
    const saved = renderPrivacy({ ...SHOWN, nameOnTvs: false });
    const choice = screen.getByRole('switch', NAME);
    expect(choice.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(choice);
    await waitFor(() => expect(saved).toEqual([{ p_is_on: true }]));
  });

  it('says so when the choice is not saved', async () => {
    renderPrivacy(SHOWN, 503);
    fireEvent.click(screen.getByRole('switch', NAME));
    expect(await screen.findByText('Not saved. Try again.', {}, { timeout: 5000 })).toBeDefined();
  });
});
