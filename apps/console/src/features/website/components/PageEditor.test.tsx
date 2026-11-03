import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageEditor } from './PageEditor.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const NEWER = 'A newer version came in. Saving makes your edits the draft.';

/** A version of the page as the database keeps it, with one text block whose heading is `heading`. */
function version(id: string, status: string, heading: string, updatedAt = '2026-11-01T10:00:00Z') {
  return {
    id, status, blocks: [{ kind: 'text', content: { heading } }], publish_at: null, published_at: status === 'published' ? '2026-11-01T10:00:00Z' : null,
    created_at: '2026-11-01T10:00:00Z', preview_token: `token-${id}`, updated_at: updatedAt,
  };
}

/** A website editor signed in, on the home page, with the versions in `history` as the database has them at each read. */
function renderEditor(history: { versions: unknown[] }) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/site_block')) return Response.json([{ kind: 'text', content: { heading: 'Our tables' } }]);
    if (url.includes('/rest/v1/site_revision')) return Response.json(history.versions);
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <PageEditor venueId="v1" page={{ pageId: 'p1', slug: 'home', title: 'Home' }} />
    </RivrDataProvider>,
  );
  return cache;
}

describe('PageEditor', () => {
  it('keeps what is typed when a newer version comes in, and says so (F2-26)', async () => {
    const history = { versions: [version('r1', 'published', 'Our tables')] };
    const cache = renderEditor(history);
    const heading = await screen.findByRole('textbox', { name: 'Heading' }, { timeout: 5000 });
    fireEvent.change(heading, { target: { value: 'Our tables tonight' } });
    history.versions = [version('r2', 'draft', 'Saved elsewhere'), ...history.versions];
    await act(() => cache.invalidateQueries());
    expect(await screen.findByText(NEWER)).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Heading' }).value).toBe('Our tables tonight');
  });

  it('starts again from a newer version when nothing here is edited', async () => {
    const history = { versions: [version('r1', 'published', 'Our tables')] };
    const cache = renderEditor(history);
    await screen.findByRole('textbox', { name: 'Heading' }, { timeout: 5000 });
    history.versions = [version('r2', 'draft', 'Saved elsewhere'), ...history.versions];
    await act(() => cache.invalidateQueries());
    expect(await screen.findByDisplayValue('Saved elsewhere')).toBeDefined();
    expect(screen.queryByText(NEWER)).toBeNull();
  });

  it('says so too when another editor saves over the same draft, which keeps its id (F2-26)', async () => {
    const history = { versions: [version('r2', 'draft', 'Our tables')] };
    const cache = renderEditor(history);
    const heading = await screen.findByRole('textbox', { name: 'Heading' }, { timeout: 5000 });
    fireEvent.change(heading, { target: { value: 'Our tables tonight' } });
    history.versions = [version('r2', 'draft', 'Saved elsewhere', '2026-11-01T10:05:00Z')];
    await act(() => cache.invalidateQueries());
    expect(await screen.findByText(NEWER)).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Heading' }).value).toBe('Our tables tonight');
  });
});
