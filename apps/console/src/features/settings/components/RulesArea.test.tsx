import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RulesArea } from './RulesArea.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const VENUE = '00000000-0000-4000-8000-000000000001';

const KEYS = [
  { key: 'waitlist.hold_minutes', description: 'Seat hold', scope: 'venue',
    value_schema: { type: 'object', properties: { minutes: { type: 'integer', minimum: 1, maximum: 120 } }, required: ['minutes'] } },
  { key: 'points.daily_staff_cap', description: 'Daily cap', scope: 'venue',
    value_schema: { type: 'object', properties: { points: { type: 'integer', minimum: 0, maximum: 1000000 } }, required: ['points'] } },
  { key: 'kyc.at_the_club', description: 'Identity checked at the club', scope: 'venue',
    value_schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } },
];

/** An admin (not a super admin) on Settings' Floor and Members areas; every setting written is kept. */
function renderArea(area: 'floor' | 'members', isSuperAdmin = false) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const written: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/setting_key')) return Response.json(KEYS);
    if (url.includes('/rest/v1/setting') && init?.method === 'POST') {
      written.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 201 });
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RulesArea venueId={VENUE} area={area} isSuperAdmin={isSuperAdmin} />
    </RivrDataProvider>,
  );
  return written;
}

describe('the KYC switch (decision 0502)', () => {
  it('sits under Settings → Floor, named for KYC, a super admin\'s to change, and a filter for KYC finds it', async () => {
    renderArea('floor', true);
    await screen.findByText('Identity (KYC) checked at the club', {}, { timeout: 5000 });
    const row = screen.getAllByRole('row').find((one) => one.textContent?.includes('Identity (KYC) checked at the club') === true);
    expect(row?.textContent).toContain('Super admin');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'KYC' } });
    expect(screen.getByText('Identity (KYC) checked at the club')).toBeDefined();
    expect(screen.queryByText('Seat hold')).toBeNull();
  });

  it('is no longer under Members and rewards', async () => {
    renderArea('members', true);
    await screen.findByText(/Daily/, {}, { timeout: 5000 }).catch(() => undefined);
    expect(screen.queryByText('Identity (KYC) checked at the club')).toBeNull();
  });
});

describe('a setting changed in its row (console v3)', () => {
  it('opens the new value under the setting’s row, with the reason’s rule in its label', async () => {
    renderArea('floor');
    fireEvent.click(await screen.findByRole('button', { name: 'Change Seat hold' }, { timeout: 5000 }));
    const rows = screen.getAllByRole('row');
    const detail = rows[rows.findIndex((row) => row.textContent?.startsWith('Seat hold') === true) + 1];
    expect(within(detail ?? document.body).getByRole('textbox', { name: 'Minutes' })).toBeDefined();
    expect(within(detail ?? document.body).getByRole('textbox', { name: 'Reason, 3 characters or more' })).toBeDefined();
    expect(within(detail ?? document.body).getByRole('radiogroup', { name: 'Takes effect' })).toBeDefined();
  });

  it('says a reason under 3 characters is too short before anything is sent, then saves from now', async () => {
    const written = renderArea('floor');
    fireEvent.click(await screen.findByRole('button', { name: 'Change Seat hold' }, { timeout: 5000 }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Minutes' }), { target: { value: '15' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(await screen.findByText('Say why, in 3 to 200 characters.')).toBeDefined();
    expect(written).toEqual([]);

    fireEvent.change(screen.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(written).toEqual([
      expect.objectContaining({ venue_id: VENUE, key: 'waitlist.hold_minutes', value: { minutes: 15 }, reason: 'Busy' }),
    ]));
  });

  it('refuses a day that is not a later one, so a change never goes backwards', async () => {
    const written = renderArea('floor');
    fireEvent.click(await screen.findByRole('button', { name: 'Change Seat hold' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('radio', { name: 'From a later day' }));
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2020-01-01' } });
    fireEvent.change(screen.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busy nights' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save change' }));
    expect(await screen.findByText('Choose a day after today.')).toBeDefined();
    expect(written).toEqual([]);
  });

  it('offers no Change on a super admin’s setting to an admin, and does to a super admin', async () => {
    renderArea('members');
    expect(await screen.findByText('Super admin', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Change / })).toBeNull();
    cleanup();
    renderArea('members', true);
    expect(await screen.findByRole('button', { name: /^Change / }, { timeout: 5000 })).toBeDefined();
  });
});
