import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
      <PageEditor venueId="v1" page={{ pageId: 'p1', slug: 'home', title: 'Home', pending: null }} />
    </RivrDataProvider>,
  );
  return cache;
}

/** A website editor on a page whose draft holds `blocks`, and what each Save draft sent. */
function renderDraft(blocks: unknown[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const saved: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/save_site_draft')) {
      saved.push(JSON.parse(String(init?.body)).p_blocks);
      return Response.json('token-saved');
    }
    if (url.includes('/rest/v1/site_block')) return Response.json(blocks);
    if (url.includes('/rest/v1/site_revision')) return Response.json([{ ...version('r1', 'published', ''), blocks }]);
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PageEditor venueId="v1" page={{ pageId: 'p1', slug: 'house-rules', title: 'House rules', pending: null }} />
    </RivrDataProvider>,
  );
  return saved;
}

/** Chooses an entry from a section's menu. */
function fromMenu(section: number, entry: string) {
  fireEvent.click(screen.getByRole('button', { name: `More for section ${String(section)}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: entry }));
}

const RULES = { kind: 'rules', content: { heading: 'House rules', rules: ['One player to a hand.', 'English only at the table.'] } };

// The owner, 12 Nov: house-rule points, and the sections themselves, are added, taken out, moved and changed (#906).
describe('PageEditor › sections and lists', () => {
  it('adds a rule, takes another out, and saves the list', async () => {
    const saved = renderDraft([RULES]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a rule' }, { timeout: 5000 }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rule 3' }), { target: { value: 'No phones at the table.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rule 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved.')).toBeDefined();
    expect(saved).toEqual([[{ kind: 'rules', content: { heading: 'House rules', rules: ['English only at the table.', 'No phones at the table.'] } }]]);
  });

  it('never takes out a list’s last item, or a page’s last section', async () => {
    renderDraft([{ kind: 'rules', content: { rules: ['One player to a hand.'] } }]);
    expect((await screen.findByRole<HTMLButtonElement>('button', { name: 'Remove Rule 1' }, { timeout: 5000 })).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'More for section 1' }));
    expect(screen.getByRole('menuitem', { name: 'Delete section' }).getAttribute('aria-disabled')).toBe('true');
  });

  // The Careers page starts with no role (review of #906).
  it('adds the first item to a list with none, and offers no second hero', async () => {
    const saved = renderDraft([{ kind: 'hero', content: { heading: 'Careers' } }, { kind: 'careers', content: { heading: 'Open roles', roles: [] } }]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a role' }, { timeout: 5000 }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Dealer' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Body' }), { target: { value: 'Deals the cards.' } });
    fromMenu(2, 'Add a section below');
    expect(within(screen.getByRole('radiogroup', { name: 'New section below section 2' })).queryByRole('radio', { name: 'Hero' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved.')).toBeDefined();
    expect(saved).toEqual([[{ kind: 'hero', content: { heading: 'Careers' } }, { kind: 'careers', content: { heading: 'Open roles', roles: [{ title: 'Dealer', body: 'Deals the cards.' }] } }]]);
  });

  it('adds a section below another, moves it up, changes a section’s kind and deletes one', async () => {
    const saved = renderDraft([{ kind: 'text', content: { heading: 'Our tables', body: 'Six of them.' } }, RULES]);
    await screen.findByRole('heading', { name: 'Section 1 · Text' }, { timeout: 5000 });

    fromMenu(1, 'Add a section below');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'New section below section 1' })).getByRole('radio', { name: 'Questions' }));
    expect(screen.getByRole('heading', { name: 'Section 2 · Questions' })).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Question' }), { target: { value: 'Open late?' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Answer' }), { target: { value: 'Till 4 am.' } });

    fromMenu(2, 'Move up');
    expect(screen.getByRole('heading', { name: 'Section 1 · Questions' })).toBeDefined();

    fromMenu(3, 'Change kind');
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Change section 3 to' })).getByRole('radio', { name: 'Text' }));
    const bodies = screen.getAllByRole('textbox', { name: 'Body' });
    fireEvent.change(bodies[bodies.length - 1] ?? document.body, { target: { value: 'Ask the floor.' } });
    expect(screen.getByRole('heading', { name: 'Section 3 · Text' })).toBeDefined();

    fromMenu(2, 'Delete section');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved.')).toBeDefined();
    expect(saved).toEqual([[
      { kind: 'faq', content: { heading: '', questions: [{ question: 'Open late?', answer: 'Till 4 am.' }] } },
      { kind: 'text', content: { heading: 'House rules', body: 'Ask the floor.' } },
    ]]);
  });
});

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

  it('has its actions above the blocks, says when it was saved, and shows the preview behind a toggle (F-029)', async () => {
    renderEditor({ versions: [version('r2', 'draft', 'Our tables', new Date(Date.now() - 120_000).toISOString())] });
    const heading = await screen.findByRole('textbox', { name: 'Heading' }, { timeout: 5000 });
    const save = screen.getByRole('button', { name: 'Save draft' });
    expect(save.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Saved 2 min ago')).toBeDefined();
    expect(screen.queryByTitle('Preview of Home')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(screen.queryByRole('textbox', { name: 'Heading' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Heading' })).toBeDefined();
  });

  it('asks for a day and time only when publishing later (F-029)', async () => {
    renderEditor({ versions: [version('r2', 'draft', 'Our tables')] });
    fireEvent.click(await screen.findByRole('button', { name: 'Publish later' }, { timeout: 5000 }));
    expect(screen.getByLabelText('Publish on')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeDefined();
  });
});
