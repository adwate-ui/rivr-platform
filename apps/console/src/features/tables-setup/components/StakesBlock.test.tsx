import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StakesBlock } from './StakesBlock.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** An admin on tables setup with no stakes yet, and a fake API that keeps every stake sent. */
function renderStakes() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/')) sent.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StakesBlock venueId="v1" stakes={[]} />
    </RivrDataProvider>,
  );
  return sent;
}

describe('a stake saved on tables setup (UI polish audit A-13, UI-19)', () => {
  it('is a secondary button that says what is missing on press, rather than a grey one that says nothing', () => {
    const sent = renderStakes();
    const save = screen.getByRole('button', { name: 'Save the stake' });
    expect(save.hasAttribute('disabled')).toBe(false);
    expect(save.className).not.toContain('bg-action');
    fireEvent.click(save);
    expect(screen.getByText('Name the stake and set both blinds, big above small, and any straddle above the big blind.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('asks no game, and takes a straddle above the big blind (decision 0299)', async () => {
    const sent = renderStakes();
    expect(screen.queryByRole('group', { name: 'Game' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Stake name' }), { target: { value: '100/200' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Small blind' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Big blind' }), { target: { value: '200' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Straddle/ }), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the stake' }));
    expect(screen.getByText('Name the stake and set both blinds, big above small, and any straddle above the big blind.')).toBeDefined();
    expect(sent).toEqual([]);

    fireEvent.change(screen.getByRole('textbox', { name: /^Straddle/ }), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the stake' }));
    await waitFor(() => expect(sent.find((call) => call.url.includes('/rpc/add_table_type'))?.body).toEqual({
      p_venue_id: 'v1', p_name: '100/200', p_small_blind_paise: 10000, p_big_blind_paise: 20000, p_straddle_paise: 40000,
    }));
  });
});
