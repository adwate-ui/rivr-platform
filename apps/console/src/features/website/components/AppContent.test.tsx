import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppContent } from './AppContent.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Content's App tab with the line the server holds (null: the app's own); `sent` keeps each save's body. */
function renderApp(held: string | null, saveReply: { status?: number; body: unknown } = { body: 'Play it on any table tonight.' }) {
  const sent: unknown[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000107', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/set_content_bonus_line')) {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json(saveReply.body, { status: saveReply.status ?? 200 });
    }
    return Response.json(url.includes('/rpc/content_bonus_line') ? held : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AppContent venueId="v1" />
    </RivrDataProvider>,
  );
  return { sent };
}

describe('Content, App', () => {
  it('shows the Bonus card line blank while the app\'s own is kept, and says what that is', async () => {
    renderApp(null);
    const field = await screen.findByRole('textbox', { name: /^Bonus card line/ });
    expect(field).toHaveProperty('value', '');
    expect(screen.getByText('Up to 120 characters. Left blank, the card says "Use with your buy-in."')).toBeDefined();
  });

  it('saves the club\'s own line and says so', async () => {
    const { sent } = renderApp('Use it tonight.');
    const field = await screen.findByRole('textbox', { name: /^Bonus card line/ });
    expect(field).toHaveProperty('value', 'Use it tonight.');
    fireEvent.change(field, { target: { value: 'Play it on any table tonight.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved')).toBeDefined();
    expect(sent).toEqual([{ p_venue_id: 'v1', p_line: 'Play it on any table tonight.' }]);
  });

  it('says when the role may not, or the club is frozen', async () => {
    renderApp(null, { status: 400, body: { code: 'RVFRZ', message: 'frozen' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Frozen. Try again once it is released.')).toBeDefined();
  });
});
