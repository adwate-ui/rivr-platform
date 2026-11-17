import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderAs } from './membersTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const table = () => screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });
const TYPED = { timeout: 3000 };

describe('The Members list (console v3; on the server, redesign RD-29)', () => {
  it('has no funnel on Tier, which the chips above it already filter (audit F-093)', async () => {
    renderAs('super_admin');
    const list = await table();
    expect(within(list).queryByRole('button', { name: /^Tier: sort and filter/ })).toBeNull();
    expect(within(list).getByRole('button', { name: /^City: sort and filter/ })).toBeDefined();
  });

  it('asks the server for the first page by name, and lists it with where each is tonight; a row opens its record', async () => {
    const { onNavigate, asked } = renderAs('super_admin');
    const list = await table();
    expect(asked[0]).toEqual({ tier_id: '', query: '', sort: { key: 'name', direction: 'ascending' }, filters: {}, scope: {}, page: 1, page_size: 50 });
    expect(await within(list).findByText('Table 2, seat 3')).toBeDefined();
    expect(within(list).getByText('Waiting')).toBeDefined();
    // One count, by the pills, in the table's own words (redesign correction 6).
    expect(screen.getByText('2 of 2')).toBeDefined();
    for (const header of ['Name', 'No.', 'Tier', 'Tonight', 'Visits', 'Bonus']) expect(within(list).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    fireEvent.click(within(list).getByRole('button', { name: 'Arjun Mehta' }));
    expect(onNavigate).toHaveBeenCalledWith('/members?member=m2');
  });

  it('shows each member\'s KYC, hours played, city, joining day and Bonus, and the mobile to a super admin (owner, 8 Nov)', async () => {
    renderAs('super_admin');
    const list = await table();
    for (const header of ['Mobile', 'Status', 'ID check', 'Hours', 'City', 'Joined']) {
      expect(within(list).getByRole('columnheader', { name: new RegExp(header) })).toBeDefined();
    }
    const sakshi = within(list).getAllByRole('row').find((row) => row.textContent?.includes('Sakshi Tandon')) ?? list;
    for (const shown of ['+91 90000 00266', 'Checked', '2 h 15 min', 'Gurugram', '20 Oct 2026', '1,500']) expect(sakshi.textContent).toContain(shown);
    const arjun = within(list).getAllByRole('row').find((row) => row.textContent?.includes('Arjun Mehta')) ?? list;
    expect(arjun.textContent).toContain('Due');
  });

  it('keeps the mobile column from other staff, and asks the server for what they type', async () => {
    const { asked } = renderAs('admin');
    const list = await table();
    expect(within(list).queryByRole('columnheader', { name: /Mobile/ })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name, mobile or member number' }), { target: { value: '98100 00263' } });
    // The server finds a mobile by its last four digits for staff who do not read numbers (supabase/tests/436).
    await waitFor(() => expect(asked.at(-1)).toMatchObject({ query: '98100 00263', page: 1 }), TYPED);
  });

  it('narrows the list on the server by a name as typed or a member number, and says when nothing matches', async () => {
    const { asked } = renderAs('super_admin');
    const list = await table();
    const search = screen.getByRole('searchbox', { name: 'Name, mobile or member number' });
    fireEvent.change(search, { target: { value: 'sak' } });
    await waitFor(() => expect(within(list).queryByRole('button', { name: 'Arjun Mehta' })).toBeNull(), TYPED);
    expect(within(list).getByRole('button', { name: 'Sakshi Tandon' })).toBeDefined();
    expect(asked.at(-1)?.query).toBe('sak');
    fireEvent.change(search, { target: { value: '63' } });
    await waitFor(() => expect(within(list).queryByRole('button', { name: 'Sakshi Tandon' })).toBeNull(), TYPED);
    expect(within(list).getByRole('button', { name: 'Arjun Mehta' })).toBeDefined();
    fireEvent.change(search, { target: { value: 'Zoya' } });
    expect(await screen.findByText('Nothing matches Zoya.', {}, TYPED)).toBeDefined();
  });

  it('says Frozen and Erased on the list; Status offers the server\'s counts and filters there by the server\'s word (F-121)', async () => {
    const { asked } = renderAs('super_admin', undefined, undefined, { '/rpc/member_account_statuses': () => [{ member_id: 'm1', status: 'frozen', until: null }, { member_id: 'm2', status: 'erased', until: null }] });
    const list = await table();
    expect(await within(list).findByText('Frozen')).toBeDefined();
    expect(within(list).getByText('Erased')).toBeDefined();
    fireEvent.click(within(list).getByRole('button', { name: /^Status: sort and filter/ }));
    const menu = screen.getByRole('dialog', { name: 'Status: sort and filter' });
    // Counted over every member, not the two on the page (redesign correction 4).
    expect(await within(menu).findByRole('button', { name: /^Active.*4,810/ })).toBeDefined();
    fireEvent.click(within(menu).getByRole('button', { name: /^Frozen/ }));
    await waitFor(() => expect(within(list).queryByRole('button', { name: 'Arjun Mehta' })).toBeNull());
    expect(within(list).getByRole('button', { name: 'Sakshi Tandon' })).toBeDefined();
    expect(asked.at(-1)?.filters).toEqual({ status: { kind: 'choice', chosen: ['frozen'] } });
  });

  it('asks the server again when the order turns to another column', async () => {
    const { asked } = renderAs('super_admin');
    const list = await table();
    fireEvent.click(within(list).getByRole('columnheader', { name: /Bonus/ }).querySelector('button') ?? list);
    await waitFor(() => expect(asked.at(-1)?.sort?.key).toBe('bonus'));
  });

  it('never calls anyone active when the statuses could not be read (F-121)', async () => {
    renderAs('super_admin', 'm1', undefined, { '/rpc/member_account_statuses': () => Response.json({ message: 'no' }, { status: 500 }) });
    const list = await table();
    await waitFor(() => expect(within(list).getAllByText('–').length).toBeGreaterThan(1));
    expect(screen.queryByText('Active')).toBeNull();
  });

  it('shortens a break on the list, with the whole of it as the title (F-121)', async () => {
    renderAs('super_admin');
    expect((await screen.findByText('Break', undefined, { timeout: 5000 })).closest('[title]')?.getAttribute('title')).toBe('On a break until 13 Dec 2026');
  });
});
