import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddTabletForm } from './AddTabletForm.tsx';
import { PairTvForm } from './PairTvForm.tsx';

/** What the fake API answers a call with, by its function or table; anything else gets nothing. */
let answers: Record<string, () => Response> = {};
let sent: { call: string; body: unknown }[] = [];

beforeEach(() => {
  answers = {};
  sent = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
    const call = path.split('/').at(-1) ?? '';
    if (init?.method === 'POST') sent.push({ call, body: JSON.parse(String(init.body)) });
    return answers[call]?.() ?? Response.json([]);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderPanel(opener: ReactElement) {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider place="console">{opener}</ToastProvider>
    </RivrDataProvider>,
  );
}

const bodiesOf = (call: string) => sent.filter((one) => one.call === call).map((one) => one.body);

describe('the devices’ panels at the side (redesign RD-38)', () => {
  it('pairs a TV by its code: a wrong code stays open to type again, the right one says so and closes', async () => {
    answers['claim_tv_pairing'] = () => Response.json({ code: 'RVCOD', message: 'No TV shows that code' }, { status: 400 });
    renderPanel(<PairTvForm venueId="v1" venueName="RIVR Gurugram" isPractice={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add a TV' }));
    const panel = within(screen.getByRole('dialog', { name: 'Pair a TV' }));
    expect(panel.getByText('A TV paired here joins RIVR Gurugram.')).toBeDefined();
    fireEvent.change(panel.getByRole('textbox', { name: 'Code on the TV' }), { target: { value: '123456' } });
    fireEvent.change(panel.getByRole('textbox', { name: 'TV name' }), { target: { value: 'Bar TV' } });
    fireEvent.click(panel.getByRole('button', { name: 'Pair the TV' }));
    expect(await panel.findByText('No TV shows that code. Check it and type it again.')).toBeDefined();
    answers['claim_tv_pairing'] = () => Response.json('d1');
    fireEvent.click(panel.getByRole('button', { name: 'Pair the TV' }));
    expect(await screen.findByText('Bar TV is paired.')).toBeDefined();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(bodiesOf('claim_tv_pairing').at(-1)).toEqual({ p_venue_id: 'v1', p_code: '123456', p_name: 'Bar TV', p_mode: 'waitlist' });
  });

  it('stops a TV with no code or name at the fields, before any call', async () => {
    renderPanel(<PairTvForm venueId="v1" venueName="RIVR Practice" isPractice />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a TV' }));
    expect(screen.getByText('Pairs to RIVR Practice, the practice venue: training figures only.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Pair the TV' }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(bodiesOf('claim_tv_pairing')).toEqual([]);
  });

  it('adds a tablet by name and hands its pairing code to the row', async () => {
    answers['device'] = () => Response.json({ id: 'd7' }, { status: 201 });
    answers['start_device_pairing'] = () => Response.json([{ code: '482913', expires_at: '2026-11-15T16:00:00Z' }]);
    const onCode = vi.fn();
    renderPanel(<AddTabletForm venueId="v1" onCode={onCode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a tablet' }));
    const panel = within(screen.getByRole('dialog', { name: 'Add a tablet' }));
    fireEvent.change(panel.getByRole('textbox', { name: 'Tablet name' }), { target: { value: 'Table 3 tablet' } });
    fireEvent.click(panel.getByRole('button', { name: 'Add and pair' }));
    await waitFor(() => expect(onCode).toHaveBeenCalledWith({ deviceId: 'd7', code: '482913', expiresAt: '2026-11-15T16:00:00Z' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(bodiesOf('device')).toEqual([{ venue_id: 'v1', kind: 'dealer_tablet', name: 'Table 3 tablet' }]);
  });

  it('says a tablet was added without a code when pairing did not start', async () => {
    answers['device'] = () => Response.json({ id: 'd7' }, { status: 201 });
    answers['start_device_pairing'] = () => Response.json({ message: 'unreachable' }, { status: 503 });
    const onCode = vi.fn();
    renderPanel(<AddTabletForm venueId="v1" onCode={onCode} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a tablet' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Tablet name' }), { target: { value: 'Table 3 tablet' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add and pair' }));
    expect(await screen.findByText('Added without a code. Press New pairing code on its row.')).toBeDefined();
    expect(onCode).not.toHaveBeenCalled();
  });
});
