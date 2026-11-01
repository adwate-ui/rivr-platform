import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemplatesList } from './TemplatesList.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Ishita, marketing, with Ladies' night among the templates, and a fake API that keeps what is sent for approval. */
function renderTemplates() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000107', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/promotion')) return Response.json([{ id: 'p1', name: "Ladies' night", detail: 'Bonus chips on the first buy-in', runs: 'Wednesday' }]);
    if (url.includes('/rpc/submit_promotion_template')) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TemplatesList venueId="v1" />
    </RivrDataProvider>,
  );
  return sent;
}

describe('the promotion templates (UI polish audit A-15)', () => {
  it('shows each template on one line, with no budget until Send for approval opens it', async () => {
    renderTemplates();
    expect(await screen.findByText("Ladies' night")).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Budget in bonus chips (optional)' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send for approval' }));
    expect(screen.getByRole('textbox', { name: 'Budget in bonus chips (optional)' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Budget in bonus chips (optional)' })).toBeNull();
  });

  it('sends the template with the budget typed in place', async () => {
    const sent = renderTemplates();
    fireEvent.click(await screen.findByRole('button', { name: 'Send for approval' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Budget in bonus chips (optional)' }), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(await screen.findByText("Ladies' night waits for a super admin.")).toBeDefined();
  });
});
