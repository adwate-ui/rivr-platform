import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import type { SarEntry } from '@rivr/db/aml';
import { fromPaise } from '@rivr/domain/money';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SarEntryPanel } from './SarEntryPanel.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const ENTRY: SarEntry = {
  id: 'e1', memberId: 'm1', fullName: 'Mihir Shah', memberNumber: 42, kind: 'structuring_visit', detectedAt: '2026-10-27T18:00:00Z',
  isOpen: true, outcome: null, note: null, reviewedBy: null, reviewedAt: null, cash: fromPaise(5_000_000n),
  buyIns: [
    { id: 'x1', source: 'cage', at: '2026-10-27T17:00:00Z', amount: fromPaise(4_500_000n) },
    { id: 'x2', source: 'tournament', at: '2026-10-27T17:30:00Z', amount: fromPaise(500_000n) },
  ],
};

/** Vikram, a super admin, signed in, and a fake API that answers the review with `reply`. */
function renderPanel(reply: () => Response) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/review_sar_entry')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><SarEntryPanel venueId="v1" entry={ENTRY} /></RivrDataProvider>);
  return sent;
}

describe('SarEntryPanel', () => {
  it('shows the cash in, each with where it came from', () => {
    renderPanel(() => new Response(null, { status: 204 }));
    const table = screen.getByRole('table', { name: 'Cash in this entry' });
    expect(table.textContent).toContain('Chips at the cage');
    expect(table.textContent).toContain('Tournament entry');
  });

  it('asks for an outcome and a note of ten characters before sending the review', async () => {
    const sent = renderPanel(() => new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole('button', { name: 'Record the review' }));
    expect(screen.getByText('Choose an outcome and write a note of 10 to 1,000 characters.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Monitor' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: ' Watching his cash for a month ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record the review' }));
    await waitFor(() => expect(sent).toEqual([{ p_entry_id: 'e1', p_outcome: 'monitor', p_note: 'Watching his cash for a month' }]));
  });

  it('says why when the database refuses', async () => {
    renderPanel(() => Response.json({ code: '42501', message: 'Only staff who review AML review the register' }, { status: 403 }));
    fireEvent.click(screen.getByRole('button', { name: 'Reported' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'Reported to the FIU today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record the review' }));
    expect(await screen.findByText('Only staff who review AML review the register.')).toBeTruthy();
  });
});
