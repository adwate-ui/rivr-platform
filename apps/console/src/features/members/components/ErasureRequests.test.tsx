import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErasureRequests } from './ErasureRequests.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** The list, its one read answered by `answer`. */
function renderList(answer: () => Response) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const read = vi.fn(async () => answer());
  vi.stubGlobal('fetch', read);
  const onOpen = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ErasureRequests venueId="v1" onOpen={onOpen} />
    </RivrDataProvider>,
  );
  return { read, onOpen };
}

describe('Deletion requests', () => {
  it('lists the members who asked, each opening their record', async () => {
    const { onOpen } = renderList(() => Response.json([{ member_id: 'm1', full_name: 'Sakshi Tandon', requested_at: '2026-11-08T05:00:00Z' }]));
    expect(await screen.findByRole('heading', { name: 'Deletion requests' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Sakshi Tandon · Asked 8 Nov/ }));
    expect(onOpen).toHaveBeenCalledWith('m1');
  });

  it('shows nothing while none wait', async () => {
    const { read } = renderList(() => Response.json([]));
    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Deletion requests' })).toBeNull();
  });

  it('says so when the list cannot be read', async () => {
    renderList(() => Response.json({ message: 'No' }, { status: 500 }));
    expect(await screen.findByText(/Not loaded/)).toBeDefined();
  });
});
