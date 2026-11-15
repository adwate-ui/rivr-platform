import { waitFor, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRANT, paged, renderAs } from './membersTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// The list's own tests are in MemberList.test.tsx.
describe('Members (console v3)', () => {
  it('opens the record of the member the address names, beside the list', async () => {
    renderAs('super_admin', 'm1');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('table', { name: 'Members' })).toBeDefined();
  });

  it('lists each visit with its tables, time played, call time and whether they left early (F-017)', async () => {
    renderAs('super_admin', 'm1');
    expect(await screen.findByText('3 Nov 2026 · Table 1, Table 3', undefined, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('5 h')).toBeDefined();
    expect(screen.getByText('Call time met')).toBeDefined();
    expect(screen.getByText('Call time not met · Left early')).toBeDefined();
  });

  it('writes the record\u2019s status on one line, without saying Member twice (F-039)', async () => {
    renderAs('super_admin', 'm1');
    expect(await screen.findByText(/^No\. 66 \u00b7 Black card tier \u00b7 /, undefined, { timeout: 5000 })).toBeDefined();
  });

  it('shows earlier visits until there are no more (F-017)', async () => {
    const visit = (n: number) => ({ visit_id: `v${String(n)}`, opened_at: '2026-11-03T14:00:00Z', closed_at: null, tables: 'Table 9', minutes_played: 60, call_time_met: null, left_early: false });
    renderAs('super_admin', 'm1', undefined, { '/rpc/member_visits': paged(25, visit) });
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, { timeout: 5000 }));
    await waitFor(() => expect(screen.getAllByText('3 Nov 2026 · Table 9')).toHaveLength(25));
    expect(screen.queryByRole('button', { name: 'Show earlier' })).toBeNull();
  });

  it('shows earlier promotions until there are no more (F-103)', async () => {
    renderAs('super_admin', 'm1', undefined, { '/rpc/member_promotion_grants': paged(25, (n) => ({ ...GRANT, grant_id: `g${String(n)}`, promotion_name: 'Nightly steps' })) });
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, { timeout: 5000 }));
    await waitFor(() => expect(screen.getAllByText(/Nightly steps/)).toHaveLength(25));
    expect(screen.queryByRole('button', { name: 'Show earlier' })).toBeNull();
  });

  it('says on the list and the record how an account stands (F-121)', async () => {
    renderAs('super_admin', 'm1');
    await waitFor(() => expect(screen.getAllByText('On a break until 13 Dec 2026')).toHaveLength(2), { timeout: 5000 });
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('shows a seated member\'s seat with a link to it on the floor, and the promotions they were given', async () => {
    const { onNavigate } = renderAs('super_admin', 'm1');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    // Half the width beside the record, the list keeps every column, its lines scrolling sideways (owner, 9 Nov).
    const table = screen.getByRole('table', { name: 'Members' });
    for (const column of [/^Mobile/, /^ID check/, /^Hours/, /^City/, /^Visits/]) expect(within(table).getByRole('columnheader', { name: column })).toBeDefined();
    // The list beside it names her seat too, in its Tonight column's title: the record's line is the one with Show.
    const show = await screen.findByRole('button', { name: 'Show Sakshi Tandon on the floor' });
    expect(show.parentElement?.textContent).toContain('Table 2, seat 3');
    fireEvent.click(show);
    expect(onNavigate).toHaveBeenCalledWith('/?table=t2&seat=3');
    expect(await screen.findByText(/Tuesday bonus: 1,000 Bonus/)).toBeDefined();
    // A perk reads as the promotion builder names it, never its code.
    expect(screen.getByText(/Founders priority: Waitlist priority$/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Account' })).toBeDefined();
  });

  it('shows Bonus on the record, then each bonus line, newest first (decision 0504; owner, 8 Nov)', async () => {
    renderAs('host', 'm1', 'bonus');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Bonus' }).getAttribute('aria-current')).toBe('page');
    // Twice: on the record's tile, and in the list's Bonus column beside it.
    await waitFor(() => expect(screen.getAllByText('1,500')).toHaveLength(2), { timeout: 5000 });
    expect(screen.getByText('Used with a buy-in in the seat sheet. Never expires.')).toBeDefined();
    expect(await screen.findByText(/Buy-in · Table 2 · seated by Aditya Malhotra$/, {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText('−1,000')).toBeDefined();
    expect(screen.getByText(/Welcome bonus$/)).toBeDefined();
    expect(screen.getByText('+2,500')).toBeDefined();
    // The player's Bonus calls it the same (owner, 8 Nov: one name each).
    expect(screen.getByRole('heading', { name: 'Bonus history' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Add|Give/ })).toBeNull();
  });

  it('shows what the member told the club at sign-up, and how they came (owner, 8 Nov)', async () => {
    renderAs('host', 'm1', 'signUp');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign-up' }).getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Salaried', {}, { timeout: 5000 })).toBeDefined();
    for (const shown of ['19 Oct 2026', 'Weekday evenings, Weekends', "Hold'em, PLO", 'ASHU', 'instagram · social · diwali']) {
      expect(screen.getByText(shown)).toBeDefined();
    }
    // No referral code and no first visit to the site on record.
    expect(screen.getAllByText('Not given')).toHaveLength(2);
  });

  it('keeps the Account part from an admin, and goes back to the list from the record', async () => {
    const { onNavigate } = renderAs('admin', 'm1', 'account');
    expect(await screen.findByRole('heading', { name: 'Sakshi Tandon', level: 2 }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Visits' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Members' }));
    expect(onNavigate).toHaveBeenCalledWith('/members');
  });
});
