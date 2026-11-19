import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { Text } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BonusReport, FnbReport, PlayersReport, WaitlistReport } from './ClubReports.tsx';

const PERIOD = { from: '2026-11-09', to: '2026-11-15', words: 'Span: Last 7 days' };
const TONIGHT = { from: '2026-11-15', to: '2026-11-15', words: 'Span: Tonight' };

/** What each read answers, by its function and, for figures and charts, its report. */
const ANSWERS: Record<string, unknown[]> = {
  'report_figures:players': [{ figure: 'check_ins', amount: 318 }, { figure: 'played', amount: 78 }, { figure: 'new_members', amount: 7 }, { figure: 'session_seconds', amount: 13_920 }],
  'report_figures:waitlist': [{ figure: 'joined', amount: 64 }, { figure: 'seated', amount: 51 }, { figure: 'wait_seconds', amount: 1320 }, { figure: 'longest_seconds', amount: 8580 }],
  'report_figures:fnb': [{ figure: 'orders', amount: 212 }, { figure: 'items', amount: 318 }, { figure: 'accept_seconds', amount: 120 }, { figure: 'serve_seconds', amount: 540 }],
  'report_figures:bonus': [{ figure: 'given', amount: 6_400_000 }, { figure: 'by_hand', amount: 300_000 }, { figure: 'used', amount: 3_850_000 }, { figure: 'outstanding', amount: 41_250_000 }],
  'report_chart:players': [{ bucket: '2026-11-14T00:30:00+00:00', amount: 140 }, { bucket: '2026-11-15T00:30:00+00:00', amount: 178 }],
  'report_chart:bonus': [{ bucket: '2026-11-15T15:30:00+00:00', amount: 250_000 }, { bucket: '2026-11-15T16:30:00+00:00', amount: 0 }],
  players_report: [
    { place: 0, measure: 'played', label: null, amount: 78 }, { place: 4, measure: 'tier', label: 'Black card', amount: 11 },
    { place: 1000, measure: 'first_visit', label: null, amount: 7 }, { place: 1001, measure: 'id_checks', label: null, amount: 21 },
  ],
  waitlist_report: [{ table_id: 't2', table_name: 'Table 2', joined: 27, seated: 22, left_list: 2, wait_seconds: 2640, longest_seconds: 8580 }],
  fnb_report: [
    { grouped_by: 'table', label: 'Table 2', orders: 40, items: 61, accept_seconds: 120, serve_seconds: 540, voided: 1 },
    { grouped_by: 'staff', label: 'Meera Iyer', orders: 38, items: 60, accept_seconds: 90, serve_seconds: 500, voided: 0 },
    { grouped_by: 'staff', label: null, orders: 2, items: 0, accept_seconds: 0, serve_seconds: 0, voided: 2 },
  ],
  // Yash on two club days; the second without a check-out yet.
  player_visits_page: [
    { total: 2, club_day: '2026-11-15', member_id: 'm214', full_name: 'Yash Gupta', member_number: 41, tier_name: 'Black card', is_base_tier: false, checked_in_at: '2026-11-15T14:30:00Z',
      checked_out_at: null, waiting_seconds: 600, tables: [{ table: 'Table 2', seconds: 7200 }], played_seconds: 7200, kyc_status: 'verified', bonus_paise: 50_000,
      visits: [{ visitId: 'vis9', openedAt: '2026-11-15T14:30:00Z', closedAt: null, sessions: [] }] },
    { total: 2, club_day: '2026-11-14', member_id: 'm214', full_name: 'Yash Gupta', member_number: 41, tier_name: 'Member', is_base_tier: true, checked_in_at: '2026-11-14T14:00:00Z',
      checked_out_at: '2026-11-14T18:00:00Z', waiting_seconds: 0, tables: [{ table: 'Table 1', seconds: 10_800 }], played_seconds: 10_800, kyc_status: 'verified', bonus_paise: 0 },
  ],
  bonus_report: [
    { source: 'promotion', label: 'Friday four-hour bonus', members: 31, grants: 31, given_paise: 3_100_000 },
    { source: 'hand', label: null, members: 2, grants: 3, given_paise: 300_000 },
    { source: 'other', label: 'Welcome back', members: 1, grants: 1, given_paise: 100_000 },
    { source: 'reversed', label: null, members: 1, grants: 1, given_paise: -50_000 },
  ],
  // Each Bonus given (#1063): by hand, a promotion once approved, a high hand, one with only its reason, and a reversal on
  // its own day, below zero (the owner, 19 Nov).
  bonus_given_page: [
    { total: 5, grant_id: 't5', given_at: '2026-11-15T17:00:00Z', member_id: 'm1', full_name: 'Ritika Das', member_number: 215, amount_paise: -50_000,
      reason: 'Given to the wrong member', source: 'reversed', promotion_name: null, staff_name: 'Vikram Rao' },
    { total: 5, grant_id: 'g1', given_at: '2026-11-15T16:00:00Z', member_id: 'm1', full_name: 'Ritika Das', member_number: 215, amount_paise: 50_000,
      reason: 'Good game tonight', source: 'by_hand', promotion_name: null, staff_name: 'Aditya Malhotra' },
    { total: 5, grant_id: 'g2', given_at: '2026-11-15T15:00:00Z', member_id: 'm2', full_name: 'Yash Gupta', member_number: 214, amount_paise: 100_000,
      reason: 'Play-time bonus', source: 'promotion', promotion_name: 'Friday four-hour bonus', staff_name: 'Kavya Menon' },
    { total: 5, grant_id: 'g3', given_at: '2026-11-15T14:00:00Z', member_id: 'm2', full_name: 'Yash Gupta', member_number: 214, amount_paise: 1_000_000,
      reason: 'High hand: Four Jacks', source: 'high_hand', promotion_name: 'High hands', staff_name: 'Aditya Malhotra' },
    { total: 5, grant_id: 'g4', given_at: '2026-11-15T13:00:00Z', member_id: 'm1', full_name: 'Ritika Das', member_number: 215, amount_paise: 20_000,
      reason: 'Welcome back', source: 'other', promotion_name: null, staff_name: null },
  ],
};

let asked: { rpc: string; body: Record<string, unknown> }[] = [];

beforeEach(() => {
  asked = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const rpc = String(input instanceof Request ? input.url : input).split('/rpc/')[1]?.split('?')[0];
    if (rpc === undefined) return Response.json([]);
    const body: Record<string, unknown> = JSON.parse(String(init?.body));
    asked.push({ rpc, body });
    return Response.json(ANSWERS[typeof body['p_report'] === 'string' ? `${rpc}:${body['p_report']}` : rpc] ?? []);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderReport(report: ReactElement) {
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {report}
    </RivrDataProvider>,
  );
}

const figure = (name: string) => screen.getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;
const rowOf = async (table: HTMLElement, name: string) => (await within(table).findByText(name)).closest('[role="row"]')?.textContent;

describe('the reports beside Tables (redesign RD-27)', () => {
  it('Players: four figures, check-ins by the day, and who played with each line’s share', async () => {
    renderReport(<PlayersReport venueId="v1" period={PERIOD} exportIn={null} />);
    const table = await screen.findByRole('table', { name: 'Players' });
    expect(await rowOf(table, 'Black card')).toBe('Black card1114%');
    expect(await rowOf(table, 'Members who played')).toContain('78100%');
    expect(await rowOf(table, 'First visit')).toBe('First visit79%');
    // An ID check is no share of the members who played.
    expect(await rowOf(table, 'ID checks done')).toBe('ID checks done21–');
    expect([figure('Check-ins'), figure('New members'), figure('Avg session')]).toEqual(['318', '7', '3 h 52 min']);
    expect(within(screen.getByRole('figure', { name: 'Check-ins by day' })).getAllByRole('listitem').map((bar) => bar.textContent)).toEqual(['14 Nov: 14014 Nov', '15 Nov: 17815 Nov']);
    expect(asked).toContainEqual({ rpc: 'players_report', body: { p_venue_id: 'v1', p_from: '2026-11-09', p_to: '2026-11-15' } });
    expect(asked).toContainEqual({ rpc: 'report_chart', body: { p_venue_id: 'v1', p_report: 'players', p_from: '2026-11-09', p_to: '2026-11-15' } });
  });

  it('Players: every visit in the span as the door lists the day, with the day first, from the server (decision 0682)', async () => {
    renderReport(<PlayersReport venueId="v1" period={PERIOD} exportIn={null} />);
    const table = await screen.findByRole('table', { name: 'Visits' });
    expect(await rowOf(table, '15 Nov 2026')).toBe('15 Nov 2026Yash Gupta41Black card20:00–10 minTable 22 h500Checked');
    // The base tier is left unsaid, as at the door.
    expect(await rowOf(table, '14 Nov 2026')).toBe('14 Nov 2026Yash Gupta41–19:3023:300 minTable 13 h0Checked');
    const read = asked.find((call) => call.rpc === 'player_visits_page');
    expect(read?.body['p_venue_id']).toBe('v1');
    expect(read?.body['p_view']).toMatchObject({ scope: { from: '2026-11-09', to: '2026-11-15' } });
  });

  it('Players: a super admin corrects a visit from its row, in the panel the route hands in (the owner, 18 Nov)', async () => {
    const Panel = ({ subtitle, visits }: { subtitle: string; visits: readonly { visitId: string }[] }) => <Text>{`${subtitle}: ${visits.map((one) => one.visitId).join()}`}</Text>;
    renderReport(<PlayersReport venueId="v1" period={PERIOD} exportIn={null} correct={Panel} />);
    const table = await screen.findByRole('table', { name: 'Visits' });
    fireEvent.click(await within(table).findByRole('button', { name: 'Correct the visit of Yash Gupta on 15 Nov 2026' }));
    expect(await screen.findByText('Yash Gupta · 15 Nov 2026: vis9')).toBeDefined();
    // A row with no visit to correct has no Correct.
    expect(within(table).getAllByRole('button', { name: /^Correct the visit/ })).toHaveLength(1);
  });

  it('Waitlist: who joined, who got a seat and the waits, then each table’s list', async () => {
    renderReport(<WaitlistReport venueId="v1" period={PERIOD} exportIn={null} />);
    expect(await rowOf(await screen.findByRole('table', { name: 'Waitlist' }), 'Table 2')).toBe('Table 22722244 min2 h 23 min');
    expect([figure('Joined a list'), figure('Got a seat'), figure('Avg wait'), figure('Longest wait')]).toEqual(['64', '51', '22 min', '2 h 23 min']);
  });

  it('Food and drink: orders, items and the times, by table and then by who accepted them, with no rupee', async () => {
    renderReport(<FnbReport venueId="v1" period={PERIOD} exportIn={null} />);
    const table = await screen.findByRole('table', { name: 'Food and drink' });
    expect(await rowOf(table, 'Table 2')).toBe('Table 240612 min9 min1');
    expect(within(table).queryByText('Meera Iyer')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'By staff member' }));
    expect(await rowOf(table, 'Meera Iyer')).toBe('Meera Iyer38602 min9 min0');
    expect(await rowOf(table, 'Not accepted')).toContain('Not accepted20');
    expect(within(table).queryByText('Table 2')).toBeNull();
    expect([figure('Orders'), figure('Items'), figure('Avg to accept'), figure('Avg to serve')]).toEqual(['212', '318', '2 min', '9 min']);
    expect(document.body.textContent).not.toContain('₹');
  });

  it('Bonus: what was given by promotion, by hand and by any other reason, as Bonus and never rupees; by the hour over one club day', async () => {
    renderReport(<BonusReport venueId="v1" period={TONIGHT} exportIn={null} />);
    const table = await screen.findByRole('table', { name: 'Bonus' });
    expect(await rowOf(table, 'Friday four-hour bonus')).toBe('Friday four-hour bonus313131,000');
    expect(await rowOf(table, 'By hand')).toBe('By hand233,000');
    expect(await rowOf(table, 'Welcome back')).toBe('Welcome back111,000');
    expect(await rowOf(table, 'Reversed')).toBe('Reversed11−500');
    expect([figure('Bonus given'), figure('By hand'), figure('Bonus used'), figure('Outstanding')]).toEqual(['64,000', '3,000', '38,500', '4,12,500']);
    expect(within(screen.getByRole('figure', { name: 'Bonus given by hour' })).getAllByRole('listitem').map((bar) => bar.textContent)).toEqual(['21:00: 2,50021:00', '22:00: 022:00']);
    expect(document.body.textContent).not.toContain('₹');
  });

  it('Bonus: each Bonus given, with who gave it and why (the owner, 17 Nov)', async () => {
    renderReport(<BonusReport venueId="v1" period={TONIGHT} exportIn={null} />);
    const list = await screen.findByRole('table', { name: 'Each Bonus given' }, { timeout: 5000 });
    const row = async (name: string) => (await within(list).findAllByRole('row')).find((one) => one.textContent?.includes(name))?.textContent ?? '';
    expect(await row('Good game tonight')).toContain('Aditya Malhotra');
    expect(await row('Play-time bonus')).toContain('Friday four-hour bonus · approved by Kavya Menon');
    expect(await row('Four Jacks')).toContain('High hand · logged by Aditya Malhotra');
    expect(await row('Welcome back')).toContain('Other');
    expect(await row('Given to the wrong member')).toContain('Reversed by Vikram Rao');
    expect(await row('Given to the wrong member')).toContain('−500');
  });

  it('says a report did not load, and asks again', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ message: 'unreachable' }, { status: 503 }));
    renderReport(<WaitlistReport venueId="v1" period={PERIOD} exportIn={null} />);
    expect(await screen.findByRole('button', { name: 'Try again' }, { timeout: 5000 })).toBeDefined();
    // The figures wait as dashes.
    expect(figure('Joined a list')).toBe('–');
  });
});
