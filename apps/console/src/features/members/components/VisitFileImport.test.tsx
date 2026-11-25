import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisitFileSheet } from './VisitFileImport.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TABLE = { id: 't5', venue_id: 'v1', name: 'Table 5', is_open: true, seats: 9, position: 5, table_type_id: 'tt1', must_move_to_table_id: null, room: 'main', min_buy_in_paise: 1000000 };
const TYPE = { id: 'tt1', name: 'NLH 50/100', game: 'nlh', small_blind_paise: 5000, big_blind_paise: 10000, straddle_paise: null };
const RITIKA = { key: '1042', member_id: 'm1', member_number: 1042, full_name: 'Ritika Das', in_force_paise: 0, owed_paise: 0, is_own: false, is_frozen: false };

/** A super admin with the sheet open, against a fake API; visits_from_file answers `reply`, and each file sent is kept. */
function renderSheet(reply: () => Response = () => Response.json(1)) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/bonus_file_members')) return Response.json([RITIKA]);
    if (url.includes('/rest/v1/game_table')) return Response.json([TABLE]);
    if (url.includes('/rest/v1/table_type')) return Response.json([TYPE]);
    if (url.includes('/rpc/visits_from_file')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VisitFileSheet venueId="v1" onClose={vi.fn()} />
    </RivrDataProvider>,
  );
  return sent;
}

function choose(text: string) {
  const picker = document.querySelector('input[type="file"]') ?? document.body;
  fireEvent.change(picker, { target: { files: [new File([text], 'visits.csv', { type: 'text/csv' })] } });
}

describe('VisitFileSheet (the owner, 25 Nov)', () => {
  it('shows each line with its member and table, and saves every line once asked twice', async () => {
    const sent = renderSheet();
    choose('Member,Date,Check-in,Check-out,Table,Reason\n1042,2026-11-20,20:00,23:30,Table 5,From the register\n');
    expect(await screen.findByText(/^Line 2 · Ritika Das · No\. 1042 · .* · 20:00 to 23:30 · Table 5 · From the register$/)).toBeDefined();
    expect(screen.getByText('1 visit')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add every visit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, add 1 visit' }));
    expect(await screen.findByText('1 visit added.')).toBeDefined();
    expect(sent).toMatchObject([{ p_venue_id: 'v1', p_lines: [{ line: 2, memberId: 'm1', tableId: 't5', openedAt: '2026-11-20T14:30:00.000Z', closedAt: '2026-11-20T18:00:00.000Z', reason: 'From the register' }] }]);
  });

  it('shows the lines to fix, with no Save', async () => {
    renderSheet();
    choose('Member,Date,Check-in,Check-out,Table,Reason\n1042,2026-11-20,20:00,23:30,Table 9,From the register\n');
    expect(await screen.findByText('Line 2: no table has that name.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add every visit' })).toBeNull();
  });

  it('names the line a refusal names', async () => {
    renderSheet(() => Response.json({ code: 'RVVCL', message: 'clash', details: '2' }, { status: 400 }));
    choose('Member,Date,Check-in,Check-out,Table,Reason\n1042,2026-11-20,20:00,23:30,Table 5,From the register\n');
    fireEvent.click(await screen.findByRole('button', { name: 'Add every visit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, add 1 visit' }));
    await waitFor(() => expect(screen.getByText('Refused at line 2. This overlaps another visit of theirs.')).toBeDefined());
  });
});
