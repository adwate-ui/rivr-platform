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

const minutes = (minimum: number) => ({ type: 'object', properties: { minutes: { type: 'integer', minimum, maximum: 120 } }, required: ['minutes'] });
const KEYS = [
  { key: 'waitlist.hold_minutes', description: 'Seat hold', scope: 'venue', value_schema: minutes(1) },
  { key: 'bonus.daily_staff_cap', description: 'Daily cap', scope: 'venue',
    value_schema: { type: 'object', properties: { chips: { type: 'integer', minimum: 50, maximum: 1000000 } }, required: ['chips'] } },
  { key: 'dealer.rotation_minutes', description: 'Dealer rotation', scope: 'venue', value_schema: minutes(10) },
  { key: 'kyc.at_the_club', description: 'Identity checked at the club', scope: 'venue',
    value_schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } },
];

/** Two days on, so it is a day to come wherever the test runs. */
const A_DAY_TO_COME = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

/** An admin (not a super admin) on one of Settings' tabs; every setting written is kept; `rows` are the values set. */
function renderArea(area: 'floor' | 'members', isSuperAdmin = false, rows: readonly unknown[] = []) {
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
    return Response.json(url.includes('/rest/v1/setting?') ? rows : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RulesArea venueId={VENUE} area={area} isSuperAdmin={isSuperAdmin} />
    </RivrDataProvider>,
  );
  return written;
}

/** Opens a setting's change and gives its panel. */
async function openChange(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Change ${name}` }, { timeout: 5000 }));
  return within(await screen.findByRole('dialog', { name }));
}

const rowOf = (name: string) => screen.getAllByRole('row').find((one) => one.textContent?.startsWith(name) === true);

describe('a tab of Settings in its groups (redesign RD-18)', () => {
  it('lists each setting under its group, with its one line, and leaves out a setting with no group', async () => {
    renderArea('floor');
    await screen.findByText('Seat hold', {}, { timeout: 5000 });
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Seating', 'Identity']);
    expect(within(screen.getByRole('table', { name: 'Seating' })).getByText('How long a called seat is held')).toBeDefined();
    expect(screen.queryByText('Dealer rotation')).toBeNull();
  });

  it('holds the KYC switch under Floor, in Identity, a super admin\'s to change, and a search for KYC finds it (decision 0502)', async () => {
    renderArea('floor', true);
    await screen.findByText('Identity (KYC) checked at the club', {}, { timeout: 5000 });
    expect(within(screen.getByRole('table', { name: 'Identity' })).getByText('Super admin')).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a setting' }), { target: { value: 'KYC' } });
    expect(screen.getByText('Identity (KYC) checked at the club')).toBeDefined();
    expect(screen.queryByText('Seat hold')).toBeNull();
    cleanup();
    renderArea('members', true);
    await screen.findByText(/Daily/, {}, { timeout: 5000 });
    expect(screen.queryByText('Identity (KYC) checked at the club')).toBeNull();
  });

  it('says what a rule runs on while nothing is set, and a dash where no change is to come (audit F-031)', async () => {
    renderArea('floor');
    expect(await screen.findByText('20 minutes (default)', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('Off (default)')).toBeDefined();
    expect(within(rowOf('Seat hold') ?? document.body).getByText('–')).toBeDefined();
  });

  it('says a change to come in its row, with when it starts', async () => {
    renderArea('floor', false, [{ id: 's1', key: 'waitlist.hold_minutes', subject: '', value: { minutes: 25 }, effective_from: `${A_DAY_TO_COME}T12:30:00+00:00`, reason: 'Busier nights', creator: null }]);
    await screen.findByText('Seat hold', {}, { timeout: 5000 });
    expect(within(rowOf('Seat hold') ?? document.body).getByText(/^From .*, 18:00: 25 minutes$/)).toBeDefined();
  });

  it('offers no Change on a super admin\'s setting to an admin, and does to a super admin', async () => {
    renderArea('members');
    expect(await screen.findByText('Super admin', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Change / })).toBeNull();
    cleanup();
    renderArea('members', true);
    expect(await screen.findByRole('button', { name: /^Change / }, { timeout: 5000 })).toBeDefined();
  });
});

describe('a setting changed in the panel on the right (redesign RD-18)', () => {
  it('opens the panel named for the setting: the new value, when, why, then in force, to come and before', async () => {
    renderArea('floor');
    const panel = await openChange('Seat hold');
    expect(panel.getByRole('textbox', { name: 'Minutes' })).toBeDefined();
    expect(panel.getByRole('textbox', { name: 'Reason, 3 characters or more' })).toBeDefined();
    expect(panel.getByRole('radiogroup', { name: 'Takes effect' })).toBeDefined();
    expect(panel.getByRole('heading', { name: 'In force' }).nextElementSibling?.textContent).toBe('20 minutes (default)');
    expect(panel.getByRole('heading', { name: 'Changes to come' })).toBeDefined();
    expect(panel.getByRole('heading', { name: 'Before' })).toBeDefined();
  });

  it('says Not set in the panel only where a rule has no default (audit F-031)', async () => {
    renderArea('members', true);
    const panel = await openChange('Daily bonus chips limit');
    expect(panel.getByRole('heading', { name: 'In force' }).nextElementSibling?.textContent).toBe('Not set');
  });

  it('says a reason under 3 characters is too short before anything is sent, then saves from now', async () => {
    const written = renderArea('floor');
    const panel = await openChange('Seat hold');
    fireEvent.change(panel.getByRole('textbox', { name: 'Minutes' }), { target: { value: '15' } });
    fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'ok' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    expect(await panel.findByText('Say why, in 3 to 200 characters.')).toBeDefined();
    expect(written).toEqual([]);

    fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busy' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(written).toEqual([expect.objectContaining({ venue_id: VENUE, key: 'waitlist.hold_minutes', value: { minutes: 15 }, reason: 'Busy' })]));
    expect(await panel.findByText('Change saved.')).toBeDefined();
  });

  it('refuses a day and time that are past or not a time, so a change never goes backwards, and saves one to come', async () => {
    const written = renderArea('floor');
    const panel = await openChange('Seat hold');
    fireEvent.change(panel.getByRole('textbox', { name: 'Minutes' }), { target: { value: '25' } });
    fireEvent.click(panel.getByRole('radio', { name: 'From a day and time' }));
    fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busy nights' } });
    const refused = async (day: string, time: string) => {
      fireEvent.change(panel.getByLabelText('Day'), { target: { value: day } });
      fireEvent.change(panel.getByRole('textbox', { name: 'Time' }), { target: { value: time } });
      fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
      expect(await panel.findByText('Choose a day and time still to come.')).toBeDefined();
      expect(written).toEqual([]);
    };
    await refused('2020-01-01', '18:00');
    await refused(A_DAY_TO_COME, '');
    await refused(A_DAY_TO_COME, '6 pm');

    fireEvent.change(panel.getByRole('textbox', { name: 'Time' }), { target: { value: '18:00' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    // 18:00 in India is 12:30 UTC.
    await waitFor(() => expect(written).toEqual([expect.objectContaining({ value: { minutes: 25 }, effective_from: `${A_DAY_TO_COME}T12:30:00.000Z` })]));
  });
});
