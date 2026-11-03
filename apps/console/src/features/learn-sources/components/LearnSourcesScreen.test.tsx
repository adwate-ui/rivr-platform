import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LearnSources } from './LearnSourcesScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Learn content', () => {
  it('says in one line there are no sources, with the one action that opens adding one', async () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }));
    vi.stubGlobal('fetch', async () => Response.json([]));
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LearnSources venueId="v1" />
      </RivrDataProvider>,
    );
    expect(await screen.findByText('No licensed sources yet.', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a source' }));
    expect(screen.getByRole('heading', { name: 'Add a source' })).toBeDefined();
    expect(screen.getByText('Choose encoding')).toBeDefined();
  });
});
