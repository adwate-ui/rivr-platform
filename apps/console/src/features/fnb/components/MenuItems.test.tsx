import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuItems } from './MenuItems.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const CHAI = { id: 'chai', name: 'Masala chai', kind: 'soft_drink', is_available: true, position: 1, photo_path: null };
const SANDWICH = { id: 'sandwich', name: 'Club sandwich', kind: 'food', is_available: true, position: 10, photo_path: null };
const BEER = { id: 'beer', name: 'Beer', kind: 'alcohol', is_available: false, position: 20, photo_path: null };

/** A staff member signed in, and a fake API whose menu is `items`, one masala chai unless given. */
function renderMenu(canManage: boolean, items: readonly object[] = [CHAI]) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const saved: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/save_fnb_item')) {
      saved.push(JSON.parse(String(init?.body)));
      return Response.json('new');
    }
    return Response.json(url.includes('/rest/v1/fnb_item') ? items : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <MenuItems venueId="v1" canManage={canManage} />
    </RivrDataProvider>,
  );
  return saved;
}

describe('MenuItems', () => {
  it('adds an item with its veg mark and a line on what it is (F-052)', async () => {
    const saved = renderMenu(true);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Item' }, { timeout: 5000 }), { target: { value: 'Paneer roll' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Veg' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: ' With mint chutney ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to the menu' }));
    await waitFor(() => expect(saved).toEqual([expect.objectContaining({ p_name: 'Paneer roll', p_diet: 'veg', p_description: 'With mint chutney' })]));
  });

  it('shows an item\u2019s mark beside its name', async () => {
    renderMenu(false, [{ ...SANDWICH, diet: 'non_veg', description: null }]);
    expect(await screen.findByRole('img', { name: 'Non-vegetarian' }, { timeout: 5000 })).toBeDefined();
  });

  it('sets each item under its kind, food first, with the name alone', async () => {
    renderMenu(false, [CHAI, SANDWICH, BEER]);
    const headings = await screen.findAllByRole('heading', { level: 2 }, { timeout: 5000 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Food', 'Soft drinks', 'Bar']);
    expect(screen.getByText('Club sandwich', { exact: true })).toBeDefined();
    expect(screen.getByText('Masala chai', { exact: true })).toBeDefined();
    expect(screen.queryByText(/ · Soft drink/)).toBeNull();
    expect(screen.getByRole('switch', { name: 'Off the menu' })).toBeDefined();
  });

  it('offers staff who run F&B a photo for each dish, and says why a file was not one (AS-11)', async () => {
    vi.stubGlobal('createImageBitmap', async () => { throw new Error('Not an image'); });
    renderMenu(true);
    expect(await screen.findByRole('button', { name: 'Add a photo of Masala chai' }, { timeout: 5000 })).toBeDefined();
    const picker = document.querySelector('input[type="file"]');
    if (picker === null) throw new Error('No file picker');
    fireEvent.change(picker, { target: { files: [new File(['not a photo'], 'menu.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Not a photo. Choose a JPEG, PNG or WebP.')).toBeDefined();
  });

  it('shows Service the menu with no photo to add: the photos are for staff who run F&B', async () => {
    renderMenu(false);
    expect(await screen.findByText(/Masala chai/, {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add a photo of Masala chai' })).toBeNull();
  });
});
