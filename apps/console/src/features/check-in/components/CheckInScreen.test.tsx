import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { MemberLinksProvider, Text } from '@rivr/ui';
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
  session_id: null, visit_id: null, linked_member_id: 'm1', wallet_paise: 0,
};
const NAKUL = {
  ...KABIR, member_id: 'm2', full_name: 'Nakul Dhillon', member_number: 270, tier_name: 'Member', is_base_tier: true, status: 'playing', list: 'in_club',
  checked_in_at: '2026-11-03T14:05:00Z', waiting_seconds: 0, tables: [{ table: 'Table 1', seconds: 5400 }], played_seconds: 5400, kyc_status: 'verified',
  bonus_paise: 150_000, phone: '+919876543210', seated_at: '2026-11-03T14:10:00Z', left_at: null, bonus_used_paise: 50_000,
  session_id: 's2', visit_id: 'v2', linked_member_id: 'm2', wallet_paise: 550_000,
};

/** Members' addresses, as the console's frame gives them, so a name the server links is a link. */
const LINKS = { hrefOf: (memberId: string) => `/members?member=${memberId}` };

/** The History panel's body, as the route hands it in (#1073). */
const History = ({ memberId }: { venueId: string; memberId: string }) => <Text>{`Visits of ${memberId}`}</Text>;
/** Use Bonus's form, as the route hands it in from the record (the owner, 20 Nov). */
const BonusForm = ({ memberId }: { venueId: string; memberId: string }) => <Text>{`Use Bonus of ${memberId}`}</Text>;
// As the server counts them over everyone at the door today: far more than the page shown.
// One member is back in: on Left and in the room, Left and Playing, so the lists and the statuses each add up to 319 and
// everyone, counted once, to 318.
const COUNTS = [
  { column_key: 'list', value: 'in_club', members: 36 }, { column_key: 'list', value: 'expected', members: 3 }, { column_key: 'list', value: 'left', members: 280 },
  { column_key: 'status', value: 'playing', members: 30 }, { column_key: 'status', value: 'waiting', members: 6 }, { column_key: 'status', value: 'expected', members: 3 },
  { column_key: 'status', value: 'left', members: 271 }, { column_key: 'status', value: 'in_room', members: 5 }, { column_key: 'status', value: 'never_arrived', members: 4 },
  { column_key: 'tier', value: 'Member', members: 290 }, { column_key: 'everyone', value: 'all', members: 318 },
];
// What the next test's server answers, when a test sets them: the page's rows and the counts.
let rows: readonly (Readonly<Record<string, unknown>> & { readonly list: string; readonly status: string })[] | null = null;
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
      <MemberLinksProvider links={LINKS}>
        <StaffVenueProvider>{pane === 'check-in' ? <CheckInScreen history={History} bonusForm={BonusForm} /> : <TodaysPlayersScreen history={History} />}</StaffVenueProvider>
      </MemberLinksProvider>
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
    expect(within(chips).getByRole('radio', { name: 'Left, 280' })).toBeDefined();
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

  it('shows a host no mobile, no History and no Use Bonus', async () => {
    renderAs('host');
    const row = (await within(await door()).findByText('Nakul Dhillon')).closest('[role="row"]');
    expect(row?.textContent).not.toContain('+91');
    expect(screen.queryByRole('button', { name: 'History of Nakul Dhillon' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Use Bonus for Nakul Dhillon' })).toBeNull();
  });

  it('gives those who give Bonus by hand Use Bonus on a checked-in member\'s first row alone, opening its form beside the table (the owner, 20 Nov)', async () => {
    // Nakul's second seat tonight, at Table 2: not his first row, which alone carries his Bonus given (bonus_paise).
    rows = [NAKUL, { ...NAKUL, session_id: 's9', seated_at: '2026-11-03T16:00:00Z', tables: [{ table: 'Table 2', seconds: 600 }], bonus_paise: null, bonus_used_paise: 0 }];
    renderAs('floor');
    const table = await door();
    expect(await within(table).findAllByRole('button', { name: 'Use Bonus for Nakul Dhillon' })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: 'Check out Nakul Dhillon' })).toHaveLength(2);
    fireEvent.click(within(table).getByRole('button', { name: 'Use Bonus for Nakul Dhillon' }));
    const panel = await screen.findByRole('dialog', { name: 'Nakul Dhillon' });
    expect(within(panel).getByText('Use Bonus of m2')).toBeDefined();
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

  it('shows the Bonus in each member\'s wallet on Check-in too, after Used (the owner, 20 Nov)', async () => {
    renderAs('floor');
    const table = await door();
    const row = (await within(table).findByText('Nakul Dhillon')).closest('[role="row"]');
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent ?? '');
    const at = headers.findIndex((header) => header.startsWith('Wallet'));
    expect(headers[at - 1]).toMatch(/^Used/);
    const cells = row instanceof HTMLElement ? within(row).getAllByRole('cell').map((cell) => cell.textContent) : [];
    expect(cells[at]).toBe('5,500');
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
    for (const name of ['In the room, 5', 'Left, 271', 'Never arrived, 4']) expect(await within(chips).findByRole('radio', { name })).toBeDefined();
  });

  it('says so when nobody has come in today', async () => {
    rows = [];
    counts = [];
    renderAs('host', 'players');
    expect(await screen.findByText('Nobody has come in today yet.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('links a member\'s name to their account on Members, and an erased member\'s name to nothing', async () => {
    rows = [NAKUL, { ...NAKUL, member_id: 'm3', full_name: 'Erased member', member_number: 12, linked_member_id: null, session_id: 's3', visit_id: 'v3' }];
    renderAs('floor', 'players');
    const table = await screen.findByRole('table', { name: 'Players today' }, { timeout: 5000 });
    expect((await within(table).findByRole('link', { name: 'Nakul Dhillon' })).getAttribute('href')).toBe('/members?member=m2');
    expect(within(table).getByText('Erased member').closest('a')).toBeNull();
  });

  it('shows the Bonus in a member\'s wallet now on their first row, whichever day it was given (the owner, 20 Nov)', async () => {
    // Given ₹5,500 on earlier days and none today: Bonus is nought, Wallet holds it; his second seat's row has none.
    rows = [
      { ...NAKUL, bonus_paise: 0, bonus_used_paise: 0, wallet_paise: 550_000 },
      { ...NAKUL, bonus_paise: null, bonus_used_paise: 0, wallet_paise: null, session_id: 's4', tables: [{ table: 'Table 2', seconds: 600 }], seated_at: '2026-11-03T16:00:00Z' },
    ];
    renderAs('host', 'players');
    const table = await screen.findByRole('table', { name: 'Players today' }, { timeout: 5000 });
    await within(table).findByText('Table 2');
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent ?? '');
    const at = (name: string) => headers.findIndex((header) => header.startsWith(name));
    expect(at('Wallet')).toBeGreaterThan(at('Bonus'));
    const [first, second] = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));
    expect(first?.[at('Wallet')]).toBe('5,500');
    expect(first?.[at('Bonus')]).toBe('0');
    expect(second?.[at('Wallet')]).toBe('–');
  });

  it('refuses staff who read no members', async () => {
    renderAs('dealer', 'players');
    expect(await screen.findByText('Not in your role. Ask an admin.', {}, { timeout: 5000 })).toBeDefined();
  });
});
