import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  const sent: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/')) sent.push(url);
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
    expect(screen.getByText('Name the stake and set both blinds, big above small.')).toBeDefined();
    expect(sent).toEqual([]);
  });
});
