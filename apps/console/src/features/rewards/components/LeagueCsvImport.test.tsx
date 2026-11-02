import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeagueCsvImport } from './LeagueCsvImport.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Aditya, who gives points, signed in, and a fake API that answers give_league_points with `reply`; the bodies it was sent. */
function renderImport(reply: () => Response) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/give_league_points')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><LeagueCsvImport venueId="v1" /></RivrDataProvider>);
  return sent;
}

/** Chooses a CSV with these lines, as the file picker hands it over. */
async function choose(text: string) {
  const picker = document.querySelector('input[type="file"]');
  if (picker === null) throw new Error('No file picker');
  fireEvent.change(picker, { target: { files: [new File([text], 'league.csv', { type: 'text/csv' })] } });
}

describe('League points from a CSV', () => {
  it('reads the file, says what it holds, and gives it once with the reason', async () => {
    const sent = renderImport(() => Response.json([{ members: 2, points: 65 }]));
    await choose('Member number,Points\n1042,40\n7,25\n');
    expect(await screen.findByText('2 members, 65 points')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'November League night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give League points' }));
    expect(await screen.findByText('65 League points given to 2 members.')).toBeDefined();
    expect(sent).toEqual([expect.objectContaining({
      p_venue_id: 'v1', p_reason: 'November League night',
      p_rows: [{ member_number: 1042, points: 40 }, { member_number: 7, points: 25 }],
    })]);
  });

  it('names each bad line and offers nothing to give until the file is right', async () => {
    renderImport(() => Response.json([]));
    await choose('1042,40\nKabir,10\n1042,5\n');
    expect(await screen.findByText('Line 2: not a member number and 1 to 10,00,000 points.')).toBeDefined();
    expect(screen.getByText('Line 3: member 1042 is listed twice.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Give League points' })).toBeNull();
  });

  it('names the numbers the club does not know, and gives nothing', async () => {
    renderImport(() => Response.json({ code: 'RVNOM', message: 'No such member at this venue', details: '7, 99' }, { status: 400 }));
    await choose('1042,40\n7,25\n99,5\n');
    fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'November League night' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give League points' }));
    expect(await screen.findByText('No member numbered 7, 99. Nothing was given.')).toBeDefined();
  });
});
