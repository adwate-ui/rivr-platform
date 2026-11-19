import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { Text } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckInScreen } from './CheckInScreen.tsx';
import { TodaysPlayersScreen } from './TodaysPlayersScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  rows = null;
  counts = COUNTS;
});

const KABIR = {
  total: 1, member_id: 'm1', full_name: 'Kabir Sethi', member_number: 31, tier_name: 'Black card', is_base_tier: false, status: 'expected', list: 'expected',
  checked_in_at: null, checked_out_at: null, waiting_seconds: 240, tables: [], played_seconds: 0, kyc_status: 'at_desk', since: '2026-11-03T14:00:00Z',
  bonus_paise: 0, phone: '+919812345678', seated_at: null, left_at: null, bonus_used_paise: null,
};
const NAKUL = {
  ...KABIR, member_id: 'm2', full_name: 'Nakul Dhillon', member_number: 270, tier_name: 'Member', is_base_tier: true, status: 'playing', list: 'in_club',
  checked_in_at: '2026-11-03T14:05:00Z', waiting_seconds: 0, tables: [{ table: 'Table 1', seconds: 5400 }], played_seconds: 5400, kyc_status: 'verified',
  bonus_paise: 150_000, phone: '+919876543210', seated_at: '2026-11-03T14:10:00Z', left_at: null, bonus_used_paise: 50_000,
};

/** The History panel's body, as the route hands it in (#1073). */
const History = ({ memberId }: { venueId: string; memberId: string }) => <Text>{`Visits of ${memberId}`}</Text>;
// As the server counts them over everyone at the door today: far more than the page shown.
const COUNTS = [
  { column_key: 'list', value: 'in_club', members: 36 }, { column_key: 'list', value: 'expected', members: 3 }, { column_key: 'list', value: 'left', members: 279 },
  { column_key: 'status', value: 'playing', members: 30 }, { column_key: 'status', value: 'waiting', members: 6 }, { column_key: 'status', value: 'expected', members: 3 },
  { column_key: 'status', value: 'left', members: 270 }, { column_key: 'status', value: 'in_room', members: 5 }, { column_key: 'status', value: 'never_arrived', members: 4 },
  { column_key: 'tier', value: 'Member', members: 290 },
];
// What the next test's server answers, when a test sets them: the page's rows and the counts.
let rows: readonly (typeof KABIR)[] | null = null;
let counts: readonly object[] = COUNTS;

interface Asked {
  readonly scope: { readonly list?: string };
  readonly filters: Readonly<Record<string, { readonly chosen?: readonly string[] }>>;
  readonly query: string;
  readonly sort: { readonly key: string; readonly direction: string } | null;
}

/** The page the server would give of the two players: by the door's list asked for, else by the statuses chosen. */
function pageOf(view: Asked): readonly object[] {
  const statuses = view.filters['status']?.chosen;
  return (rows ?? [KABIR, NAKUL]).filter((row) => (view.scope.list === undefined || row.list === view.scope.list) && (statuses === undefined || statuses.includes(row.status)));
}

/** A staff member in `role` at the door, on Check-in or Today's players; gives every view asked of the server and every call that changes something. */
function renderAs(role: string, pane: 'check-in' | 'players' = 'check-in') {
  const asked: Asked[] = [];
  const calls: string[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Sunita Pillai', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/door_page')) {
      const view: Asked = JSON.parse(String(init?.body)).p_view;
      asked.push(view);
      return Response.json(pageOf(view));
    }
    if (url.includes('/rpc/list_choices')) return Response.json(counts);
    if (url.includes('/rpc/check_')) calls.push(url.split('/rpc/')[1]?.split('?')[0] ?? '');
    return Response.json(url.includes('/rpc/check_') ? 'v1' : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider>{pane === 'check-in' ? <CheckInScreen history={History} /> : <TodaysPlayersScreen history={History} />}</StaffVenueProvider>
    </RivrDataProvider>,
  );
  return { asked, calls };
}

const door = () => screen.findByRole('table', { name: 'At the door today' }, { timeout: 5000 });

describe('Check-in (the door as one table from the server, redesign RD-30)', () => {
  it('shows the one field, then the members in the room with Check out, and the door\'s lists as chips with the server\'s counts', async () => {
    const { asked } = renderAs('host');
    expect(await screen.findByRole('textbox', { name: 'Name, mobile or member number' }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Check-in' })).toBeDefined();
    const table = await door();
    expect(await within(table).findByRole('button', { name: 'Check out Nakul Dhillon' })).toBeDefined();
    expect(within(table).queryByText('Kabir Sethi')).toBeNull();
    expect(asked[0]).toMatchObject({ scope: { list: 'in_club' }, page: 1, page_size: 50 });
    const chips = screen.getByRole('radiogroup', { name: 'List' });
    expect(await within(chips).findByRole('radio', { name: 'In the room, 36' })).toBeDefined();
    expect(within(chips).getByRole('radio', { name: 'Expected tonight, 3' })).toBeDefined();
    expect(within(chips).getByRole('radio', { name: 'Left, 279' })).toBeDefined();
  });

  it('tells members apart by number, with the tier only above the base one (audit F-020), where each stands, the time played and the ID check', async () => {
    renderAs('host');
    const row = (await within(await door()).findByText('Nakul Dhillon')).closest('[role="row"]');
    // With the Bonus given to him today (#1062).
    for (const shown of ['270', 'Playing', 'Table 1', '1 h 30 min', '1,500', 'Checked']) expect(row?.textContent).toContain(shown);
    // Nakul is of the base tier: his row names none. Kabir's names his.
    expect(row?.textContent).not.toContain('Member');
    fireEvent.click(screen.getByRole('radio', { name: /^Expected tonight/ }));
    const kabir = (await within(await door()).findByText('Kabir Sethi')).closest('[role="row"]');
    expect(kabir?.textContent).toContain('31');
    expect(kabir?.textContent).toContain('Black card');
  });

  it('shows floor and up each member\'s mobile, and opens their History beside the table (the owner, 18 Nov)', async () => {
    renderAs('floor', 'players');
    const row = (await within(await screen.findByRole('table', { name: 'Players today' }, { timeout: 5000 })).findByText('Nakul Dhillon')).closest('[role="row"]');
    expect(row?.textContent).toContain('+91 98765 43210');
    fireEvent.click(screen.getByRole('button', { name: 'History of Nakul Dhillon' }));
    const panel = await screen.findByRole('dialog', { name: 'Nakul Dhillon' });
    expect(within(panel).getByText('Visits of m2')).toBeDefined();
  });

  it('puts History beside the row\'s button on Check-in, for floor and up', async () => {
    renderAs('floor');
    const row = (await within(await door()).findByText('Nakul Dhillon')).closest('[role="row"]');
    expect(row?.textContent).toContain('+91 98765 43210');
    expect(row?.textContent).toContain('History');
    expect(screen.getByRole('button', { name: 'History of Nakul Dhillon' })).toBeDefined();
  });

  it('shows a host no mobile and no History', async () => {
    renderAs('host');
    const row = (await within(await door()).findByText('Nakul Dhillon')).closest('[role="row"]');
    expect(row?.textContent).not.toContain('+91');
    expect(screen.queryByRole('button', { name: 'History of Nakul Dhillon' })).toBeNull();
  });

  it('asks the server for the members expected, and checks one in from their row', async () => {
    const { asked, calls } = renderAs('host');
    await door();
    fireEvent.click(await screen.findByRole('radio', { name: /^Expected tonight/ }));
    const checkIn = await screen.findByRole('button', { name: 'Check in Kabir Sethi' });
    expect(asked.at(-1)).toMatchObject({ scope: { list: 'expected' }, page: 1 });
    expect(screen.queryByText('Nakul Dhillon')).toBeNull();
    fireEvent.click(checkIn);
    await waitFor(() => expect(calls).toContain('check_in'));
  });

  it('refuses a dealer, who keeps no door', async () => {
    renderAs('dealer');
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });
});

describe('Today\'s players (issue 641; on the server, redesign RD-30)', () => {
  it('lists everyone at the club today, with a count on each status, and narrows by status on the server', async () => {
    const { asked } = renderAs('host', 'players');
    const table = await screen.findByRole('table', { name: 'Players today' }, { timeout: 5000 });
    expect(await within(table).findByText('Kabir Sethi')).toBeDefined();
    expect(within(table).getByText('Nakul Dhillon')).toBeDefined();
    // No row has a button: the door acts on Check-in.
    expect(within(table).queryByRole('button', { name: /^Check (in|out) / })).toBeNull();
    const chips = screen.getByRole('radiogroup', { name: 'Status' });
    expect(await within(chips).findByRole('radio', { name: 'All, 318' })).toBeDefined();
    for (const name of ['Playing, 30', 'Waiting, 9']) expect(within(chips).getByRole('radio', { name })).toBeDefined();
    // A player waiting counts whether in the room or expected at the door.
    fireEvent.click(within(chips).getByRole('radio', { name: 'Waiting, 9' }));
    await waitFor(() => expect(asked.at(-1)?.filters['status']?.chosen).toEqual(['waiting', 'expected']));
    await waitFor(() => expect(within(table).queryByText('Nakul Dhillon')).toBeNull());
    expect(within(table).getByText('Expected')).toBeDefined();
  });

  it('opens sorted by need, those waiting first, which the server orders (the task review)', async () => {
    const { asked } = renderAs('host', 'players');
    await screen.findByRole('table', { name: 'Players today' }, { timeout: 5000 });
    expect(asked[0]?.sort).toEqual({ key: 'status', direction: 'ascending' });
  });

  it('tells who is in the room and who never arrived from who left (audit F-097)', async () => {
    renderAs('host', 'players');
    const chips = await screen.findByRole('radiogroup', { name: 'Status' }, { timeout: 5000 });
    for (const name of ['In the room, 5', 'Left, 270', 'Never arrived, 4']) expect(await within(chips).findByRole('radio', { name })).toBeDefined();
  });

  it('says so when nobody has come in today', async () => {
    rows = [];
    counts = [];
    renderAs('host', 'players');
    expect(await screen.findByText('Nobody has come in today yet.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('refuses staff who read no members', async () => {
    renderAs('dealer', 'players');
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });
});
