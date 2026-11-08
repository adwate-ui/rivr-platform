import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuCsvImport } from './MenuCsvImport.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Staff who run F&B signed in, and a fake API that answers save_fnb_menu with `reply`; the bodies it was sent. */
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
    if (url.includes('/rpc/save_fnb_menu')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><MenuCsvImport venueId="v1" /></RivrDataProvider>);
  return sent;
}

/** Chooses a CSV with these lines, as the file picker hands it over. */
function choose(text: string) {
  const picker = document.querySelector('input[type="file"]');
  if (picker === null) throw new Error('No file picker');
  fireEvent.change(picker, { target: { files: [new File([text], 'menu.csv', { type: 'text/csv' })] } });
}

describe('The menu from a CSV', () => {
  it('shows each item before saving, then saves them all at once', async () => {
    const sent = renderImport(() => Response.json(2));
    choose('name,type,price,on offer\nClub sandwich,food,120,yes\nBeer,bar,350,no\n');
    expect(await screen.findByText('Club sandwich · Food · On offer')).toBeDefined();
    expect(screen.getByText('Beer · Bar · Off the menu')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));
    expect(await screen.findByText('2 items saved to the menu.')).toBeDefined();
    expect(sent).toEqual([{
      p_venue_id: 'v1',
      p_items: [{ name: 'Club sandwich', kind: 'food', is_available: true, diet: null, description: null }, { name: 'Beer', kind: 'alcohol', is_available: false, diet: null, description: null }],
    }]);
  });

  it('shows the diet and description it will save, and neither for a line that leaves them as they are (F-052)', async () => {
    renderImport(() => Response.json(2));
    choose('name,type,diet,description\nClub sandwich,food,non veg,Chicken and egg on toast\nBeer,bar,,\n');
    expect(await screen.findByRole('img', { name: 'Non-vegetarian' })).toBeDefined();
    expect(screen.getByText('Chicken and egg on toast')).toBeDefined();
    expect(screen.getAllByRole('img', { name: /vegetarian|egg/i })).toHaveLength(1);
  });

  it('names what is wrong on each line, and offers no save until the file is right', async () => {
    renderImport(() => Response.json(0));
    choose('name,type\nClub sandwich,food\nTea,dessert\nClub sandwich,food\n');
    expect(await screen.findByText('Line 3: use food, soft drinks or bar as the type.')).toBeDefined();
    expect(screen.getByText('Line 4: Club sandwich is listed twice.')).toBeDefined();
    expect(screen.getByText('Club sandwich · Food')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Save items' })).toBeNull();
  });

  it('leaves on offer out of a line that does not say, and sends it as unsaid', async () => {
    const sent = renderImport(() => Response.json(1));
    choose(['name,type,price', 'Beer,bar,350'].join(String.fromCharCode(10)));
    expect(await screen.findByText('Beer · Bar')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save items' }));
    expect(await screen.findByText('1 item saved to the menu.')).toBeDefined();
    expect(sent).toEqual([{ p_venue_id: 'v1', p_items: [{ name: 'Beer', kind: 'alcohol', is_available: null, diet: null, description: null }] }]);
  });

  it('says a file without its column names is not the menu', async () => {
    renderImport(() => Response.json(0));
    choose('Club sandwich,food\n');
    expect(await screen.findByText('Name the columns on the first line: name and type.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Save items' })).toBeNull();
  });

  it('says why the menu was not saved', async () => {
    renderImport(() => Response.json({ code: 'RVFRZ', message: 'Frozen' }, { status: 400 }));
    choose('name,type\nClub sandwich,food\n');
    fireEvent.click(await screen.findByRole('button', { name: 'Save items' }));
    expect(await screen.findByText('Venue frozen. Try again once it is released.')).toBeDefined();
  });
});
