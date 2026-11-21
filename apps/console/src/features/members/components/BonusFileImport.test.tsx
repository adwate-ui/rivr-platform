import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonusFileImport } from './BonusFileImport.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const MEMBERS = [
  { key: '1042', member_id: 'm1', member_number: 1042, full_name: 'Ritika Das', in_force_paise: 100_000, owed_paise: 0, is_own: false },
  { key: '+919000000216', member_id: 'm2', member_number: 1043, full_name: 'Kunal Mehra', in_force_paise: 0, owed_paise: 0, is_own: false },
];

/** A super admin signed in, and a fake API: the members a file names, and bonus_from_file answered with `reply`; the bodies it was sent. */
function renderImport(reply: () => Response) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000102', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/bonus_file_members')) return Response.json(MEMBERS);
    if (url.includes('/rpc/bonus_from_file')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><BonusFileImport venueId="v1" /></RivrDataProvider>);
  return sent;
}

/** Chooses a file with this text, as the file picker hands it over. */
function choose(text: string, name = 'bonus.csv') {
  const picker = document.querySelector('input[type="file"]');
  if (picker === null) throw new Error('No file picker');
  fireEvent.change(picker, { target: { files: [new File([text], name, { type: 'text/csv' })] } });
}

describe('Bonus from a file', () => {
  it('shows each line with its member before saving, then saves them all once asked twice', async () => {
    const sent = renderImport(() => Response.json(2));
    choose('Member,Type,Chips,Reason\n1042,Add,500,Diwali gift\n9000000216,Add,"2,000",Referral\n');
    expect(await screen.findByText('Line 2 · Ritika Das · No. 1042 · Add 500 · Diwali gift')).toBeDefined();
    expect(screen.getByText('Line 3 · Kunal Mehra · No. 1043 · Add 2,000 · Referral')).toBeDefined();
    expect(screen.getByText('2 lines · 2,500 added · 0 used')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save every line' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, save 2 lines' }));
    expect(await screen.findByText('2 lines saved.')).toBeDefined();
    expect(sent).toEqual([{
      p_venue_id: 'v1', p_request_id: expect.any(String),
      p_lines: [{ line: 2, member_id: 'm1', kind: 'add', chips: 500, reason: 'Diwali gift' }, { line: 3, member_id: 'm2', kind: 'add', chips: 2000, reason: 'Referral' }],
    }]);
  });

  it('shows what is wrong with each line and offers no Save', async () => {
    renderImport(() => Response.json(1));
    choose('Member,Type,Chips,Reason\n1042,Use,1050,At the bar\n555,Add,50,Gift\n1042,gift,50,Gift\n');
    expect(await screen.findByText('Line 2: more than their Bonus by then.')).toBeDefined();
    expect(screen.getByText('Line 3: no member has that number or mobile.')).toBeDefined();
    expect(screen.getByText('Line 4: write add or use under type.')).toBeDefined();
    expect(screen.getByText('Nothing saves until every line is right. Fix the file and choose it again.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Save every line' })).toBeNull();
  });

  it('says which line the database refused, and that nothing was saved', async () => {
    renderImport(() => Response.json({ code: 'RVBON', message: 'Line 2: more than the Bonus in force', details: '2' }, { status: 400 }));
    choose('Member,Type,Chips,Reason\n1042,Use,1000,At the bar\n');
    fireEvent.click(await screen.findByRole('button', { name: 'Save every line' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, save 1 line' }));
    expect(await screen.findByText('Line 2: More than their Bonus, or some owed. Nothing saved.')).toBeDefined();
  });

  it('says what is wrong with the whole file', async () => {
    renderImport(() => Response.json(1));
    choose('Member,Chips\n1042,50\n');
    expect(await screen.findByText('Name the columns on the first line: member, type, chips and reason.')).toBeDefined();
    fireEvent.change(document.querySelector('input[type="file"]') ?? document.body, {
      target: { files: [new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'old.xls')] },
    });
    expect(await screen.findByText('Not read. Choose a CSV or .xlsx file.')).toBeDefined();
  });
});
