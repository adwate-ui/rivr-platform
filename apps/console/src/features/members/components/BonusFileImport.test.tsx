import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonusFileSheet } from './BonusFileImport.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

/** The members a file names, Ritika holding `ritika` paise of Bonus. */
const membersHolding = (ritika: number) => [
  { key: '1042', member_id: 'm1', member_number: 1042, full_name: 'Ritika Das', in_force_paise: ritika, owed_paise: 0, is_own: false, is_frozen: false },
  { key: '+919000000216', member_id: 'm2', member_number: 1043, full_name: 'Kunal Mehra', in_force_paise: 0, owed_paise: 0, is_own: false, is_frozen: false },
];

interface Sent { readonly p_request_id: string; readonly p_lines: unknown }

interface Fake {
  /** bonus_from_file's answer; it may throw, as a request that never got an answer, or wait. */
  readonly reply: () => Response | Promise<Response>;
  readonly sent?: Sent[];
  readonly onClose?: () => void;
  /** What Ritika holds each time the members are read. */
  readonly ritika?: () => number;
  readonly queryClient?: QueryClient;
}

/** A super admin signed in and the sheet open, against a fake API; the bodies bonus_from_file was sent go into `sent`. */
function renderSheet({ reply, sent = [], onClose = vi.fn(), ritika = () => 100_000, queryClient = new QueryClient() }: Fake) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000102', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/bonus_file_members')) return Response.json(membersHolding(ritika()));
    if (url.includes('/rpc/bonus_from_file')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client} queryClient={queryClient}><BonusFileSheet venueId="v1" onClose={onClose} /></RivrDataProvider>);
  return { sent, onClose };
}

/** Chooses a file with this text, as the file picker hands it over. */
function choose(text: string) {
  const picker = document.querySelector('input[type="file"]');
  if (picker === null) throw new Error('No file picker');
  fireEvent.change(picker, { target: { files: [new File([text], 'bonus.csv', { type: 'text/csv' })] } });
}

/** Save, then Yes. */
async function save(count: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Save every line' }));
  fireEvent.click(screen.getByRole('button', { name: `Yes, save ${count}` }));
}

const noAnswer = () => { throw new TypeError('Failed to fetch'); };
const ONE_ADD = 'Member,Type,Chips,Reason\n1042,Add,500,Diwali gift\n';
const ONE_USE = 'Member,Type,Chips,Reason\n1042,Use,1000,At the bar\n';

describe('Bonus from a file', () => {
  it('shows the totals and each line with its member, then saves them all from the sheet\'s foot once asked twice', async () => {
    const { sent } = renderSheet({ reply: () => Response.json(2) });
    choose('Member,Type,Chips,Reason\n1042,Add,500,Diwali gift\n9000000216,Add,"2,000",Referral\n');
    expect(await screen.findByText('Line 2 · Ritika Das · No. 1042 · Add 500 · Diwali gift')).toBeDefined();
    expect(screen.getByText('Line 3 · Kunal Mehra · No. 1043 · Add 2,000 · Referral')).toBeDefined();
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain('2 lines · 2,500 added · 0 used');
    fireEvent.click(screen.getByRole('button', { name: 'Save every line' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, save 2 lines' }));
    expect(await screen.findByText('2 lines saved.')).toBeDefined();
    expect(sent).toEqual([{
      p_venue_id: 'v1', p_request_id: expect.any(String),
      p_lines: [{ line: 2, member_id: 'm1', kind: 'add', chips: 500, reason: 'Diwali gift' }, { line: 3, member_id: 'm2', kind: 'add', chips: 2000, reason: 'Referral' }],
    }]);
  });

  it('shows the lines to fix alone, by name where it knows the member, says once how many, and offers no Save', async () => {
    renderSheet({ reply: () => Response.json(1) });
    choose('Member,Type,Chips,Reason\n1042,Use,1050,At the bar\n555,Add,50,Gift\n1042,gift,50,Gift\n9000000216,Add,50,Fine\n');
    expect(await screen.findByText('Line 2: more than Ritika Das holds by then.')).toBeDefined();
    expect(screen.getByText('Line 3: no member has that number or mobile.')).toBeDefined();
    expect(screen.getByText('Line 4: write add or use under type.')).toBeDefined();
    expect(screen.queryByText(/^Line 5/)).toBeNull();
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual(['Fix 3 lines, then choose the file again.']);
    expect(screen.queryByRole('button', { name: 'Save every line' })).toBeNull();
  });

  it('says beside Save at which line the database refused, and that nothing was saved', async () => {
    renderSheet({ reply: () => Response.json({ code: 'RVBON', message: 'Line 2: more than the Bonus in force', details: '2' }, { status: 400 }) });
    choose(ONE_USE);
    await save('1 line');
    expect(await screen.findByText('Refused at line 2. More than their Bonus, or some owed. Nothing saved.')).toBeDefined();
  });

  it('keeps the file as sent after no answer, even once the members, read again, hold what it took', async () => {
    let ritika = 100_000;
    const queryClient = new QueryClient();
    const { sent } = renderSheet({ reply: noAnswer, ritika: () => ritika, queryClient });
    choose(ONE_USE);
    await save('1 line');
    expect(await screen.findByText('No answer. Save again.')).toBeDefined();
    // It went: read again, she holds nothing, and a live preview would say the Use is more than she holds.
    ritika = 0;
    await act(() => queryClient.invalidateQueries());
    expect(screen.queryByText('Line 2: more than Ritika Das holds by then.')).toBeNull();
    expect(screen.getByText('Line 2 · Ritika Das · No. 1042 · Use 1,000 · At the bar')).toBeDefined();
    await save('1 line');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.p_request_id).toBe(sent[0]?.p_request_id);
  });

  it('offers a file sent with no answer again in a sheet opened again, under its id, though its balances have changed', async () => {
    const sent: Sent[] = [];
    renderSheet({ reply: noAnswer, sent });
    choose(ONE_USE);
    await save('1 line');
    expect(await screen.findByText('No answer. Save again.')).toBeDefined();
    cleanup();
    renderSheet({ reply: () => Response.json(1), sent, ritika: () => 0 });
    choose(ONE_USE);
    expect(await screen.findByText('Sent before with no answer. Save again to see if it went.')).toBeDefined();
    await save('1 line');
    expect(await screen.findByText('1 line saved.')).toBeDefined();
    expect(sent[1]?.p_request_id).toBe(sent[0]?.p_request_id);
    // Saved: the next save of that file is a new one.
    cleanup();
    renderSheet({ reply: () => Response.json(1), sent });
    choose(ONE_USE);
    await save('1 line');
    await waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2]?.p_request_id).not.toBe(sent[0]?.p_request_id);
  });

  it('shows another file chosen after no answer, and Save sends that file', async () => {
    const { sent } = renderSheet({ reply: noAnswer });
    choose(ONE_USE);
    await save('1 line');
    expect(await screen.findByText('No answer. Save again.')).toBeDefined();
    choose(ONE_ADD);
    expect(await screen.findByText('Line 2 · Ritika Das · No. 1042 · Add 500 · Diwali gift')).toBeDefined();
    expect(screen.queryByText(/Use 1,000/)).toBeNull();
    expect(screen.queryByText('No answer. Save again.')).toBeNull();
    await save('1 line');
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.p_lines).toEqual([{ line: 2, member_id: 'm1', kind: 'add', chips: 500, reason: 'Diwali gift' }]);
    expect(sent[1]?.p_request_id).not.toBe(sent[0]?.p_request_id);
  });

  it('stays open, and holds the chooser, while a file is saving, so its answer is seen', async () => {
    let answer: (response: Response) => void = () => undefined;
    const { onClose } = renderSheet({ reply: () => new Promise<Response>((resolve) => { answer = resolve; }) });
    choose(ONE_ADD);
    await save('1 line');
    expect(await screen.findByText('Saving. This stays open until it is done.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    answer(Response.json(1));
    expect(await screen.findByText('1 line saved.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says what is wrong with the whole file', async () => {
    renderSheet({ reply: () => Response.json(1) });
    choose('Member,Chips\n1042,50\n');
    expect(await screen.findByText('Name the columns on the first line: member, type, chips and reason.')).toBeDefined();
    fireEvent.change(document.querySelector('input[type="file"]') ?? document.body, {
      target: { files: [new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], 'old.xls')] },
    });
    expect(await screen.findByText('Not read. Choose a CSV or .xlsx file.')).toBeDefined();
  });
});
