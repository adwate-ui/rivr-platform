import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderSetup, rowOf, stake, table } from './setupTestApi.tsx';
import { TablesBlock } from './TablesBlock.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// The third stake has no call time yet, so no table may play it.
const STAKES = [stake('s1', 'NLH 100/200'), stake('s2', 'NLH 50/100', { smallBlind: 5000n, bigBlind: 10000n }), stake('s3', 'NLH 500/1000', { bigBlind: 100000n, callTimeMinutes: 0 })];
const TABLES = [
  table('t1', 'Table 1', { isOpen: true, seated: 7 }),
  table('t2', 'Table 2', { waiting: 2 }),
  // Its own minimum, not the 50 big blinds its stake would suggest.
  table('t3', 'Table 3', { minBuyIn: 735000n }),
  table('t5', 'Table 5', { isActive: false }),
];

const renderTables = (refusals: Record<string, string> = {}) => renderSetup(<TablesBlock venueId="v1" stakes={STAKES} tables={TABLES} />, refusals);

/** Opens a table's menu and presses one of its steps. */
const pressStep = (name: string, step: string) => {
  fireEvent.click(screen.getByRole('button', { name: `More for ${name}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: step }));
};
const minBuyIn = (panel: HTMLElement) => within(panel).getByRole('textbox', { name: /Minimum buy-in/ });

describe('tables setup: changed with players seated (the owner, 25 Nov)', () => {
  it('names the seat taken when fewer seats are refused', async () => {
    const seat9 = { session_id: 'p9', table_id: 't1', seat: 9, member_id: 'm9', full_name: 'Ritika Das', tier_name: 'Member', started_at: '2026-11-25T14:00:00Z' };
    renderSetup(<TablesBlock venueId="v1" stakes={STAKES} tables={TABLES} />, { set_game_table: 'RVOCC' }, [seat9]);
    fireEvent.click(screen.getByRole('button', { name: 'Change table Table 1' }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('radio', { name: '8' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Seat 9 is taken. Move the player first.')).toBeDefined();
  });

  it('names the seats held for waitlist calls when none taken is seated', async () => {
    const held = [8, 9].map((seat) => ({ table_id: 't1', seat, full_name: `Player ${seat}`, entry_id: `e${seat}` }));
    renderSetup(<TablesBlock venueId="v1" stakes={STAKES} tables={TABLES} />, { set_game_table: 'RVOCC' }, [], held);
    fireEvent.click(screen.getByRole('button', { name: 'Change table Table 1' }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('radio', { name: '7' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Seats 8 and 9 are held for waitlist calls. Seat the players or hold their places first.')).toBeDefined();
  });

  it('names the seats taken and the seats held together', async () => {
    const seat9 = { session_id: 'p9', table_id: 't1', seat: 9, member_id: 'm9', full_name: 'Ritika Das', tier_name: 'Member', started_at: '2026-11-25T14:00:00Z' };
    renderSetup(<TablesBlock venueId="v1" stakes={STAKES} tables={TABLES} />, { set_game_table: 'RVOCC' }, [seat9],
      [{ table_id: 't1', seat: 8, full_name: 'Player 8', entry_id: 'e8' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Change table Table 1' }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('radio', { name: '7' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText(
      'Seat 9 is taken. Move the player first. Seat 8 is held for a waitlist call. Seat the player or hold their place first.')).toBeDefined();
  });

  it('names the count chosen when the floor has not said which seats', async () => {
    renderSetup(<TablesBlock venueId="v1" stakes={STAKES} tables={TABLES} />, { set_game_table: 'RVOCC' });
    fireEvent.click(screen.getByRole('button', { name: 'Change table Table 1' }));
    const panel = await screen.findByRole('dialog');
    fireEvent.click(within(panel).getByRole('radio', { name: '7' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('A seat above 7 is taken or held.')).toBeDefined();
  });
});

describe('tables setup: deactivate, reactivate and delete (decision 0466)', () => {
  it('says where each table stands, with its own minimum buy-in', () => {
    renderTables();
    expect(rowOf('Table 1').textContent).toContain('Open · 7 seated');
    expect(rowOf('Table 1').textContent).toContain('₹10,000');
    expect(rowOf('Table 3').textContent).toContain('Closed tonight');
    expect(rowOf('Table 3').textContent).toContain('₹7,350');
    expect(rowOf('Table 5').textContent).toContain('Inactive · hidden from the floor');
  });

  it('keeps one button, Change, on the row and every other step behind its menu (audit F-118)', () => {
    renderTables();
    expect(within(rowOf('Table 3')).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Change table Table 3', 'More for Table 3']);
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 3' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Open', 'Deactivate', 'Delete']);
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 5' }));
    // An inactive table is opened by nobody until it is back.
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Reactivate', 'Delete']);
  });

  it('opens a closed table and closes an open one from the menu, saying why a table with players stays open', async () => {
    const sent = renderTables({});
    pressStep('Table 3', 'Open');
    await waitFor(() => expect(screen.getByText('Table 3 is open.')).toBeDefined());
    expect(sent).toEqual([{ rpc: 'set_table_open', body: { p_table_id: 't3', p_is_open: true } }]);
    cleanup();
    const refused = renderTables({ set_table_open: 'RVSTD' });
    pressStep('Table 1', 'Close');
    await waitFor(() => expect(screen.getByText('Players sit at Table 1. Move them first.')).toBeDefined());
    expect(refused).toEqual([{ rpc: 'set_table_open', body: { p_table_id: 't1', p_is_open: false } }]);
  });

  it('dims Deactivate and Delete on a table in play, saying why, and sends nothing: seated first, then waiting', () => {
    const sent = renderTables();
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 1' }));
    const seated = screen.getByRole('menuitem', { name: 'Deactivate · Players seated' });
    expect(seated.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(seated);
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'More for Table 2' }));
    const waiting = screen.getByRole('menuitem', { name: 'Delete · Players waiting' });
    expect(waiting.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(waiting);
    expect(screen.queryByRole('button', { name: 'Yes, delete Table 2' })).toBeNull();
    expect(sent).toEqual([]);
  });

  it('deactivates an empty table and reactivates an inactive one, saying so', async () => {
    const sent = renderTables();
    pressStep('Table 3', 'Deactivate');
    await waitFor(() => expect(screen.getByText('Table 3 deactivated. Its history stays.')).toBeDefined());
    pressStep('Table 5', 'Reactivate');
    await waitFor(() => expect(screen.getByText('Table 5 is back, closed.')).toBeDefined());
    expect(sent).toEqual([{ rpc: 'deactivate_game_table', body: { p_table_id: 't3' } }, { rpc: 'reactivate_game_table', body: { p_table_id: 't5' } }]);
  });

  it('deletes only once asked, and says the history stays; or why the database refused on its own count', async () => {
    const sent = renderTables();
    pressStep('Table 3', 'Delete');
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete Table 3' }));
    await waitFor(() => expect(screen.getByText('Table 3 deleted. Its history stays.')).toBeDefined());
    expect(sent).toEqual([{ rpc: 'delete_game_table', body: { p_table_id: 't3' } }]);
    cleanup();
    renderTables({ delete_game_table: 'RVWTG' });
    pressStep('Table 3', 'Delete');
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete Table 3' }));
    await waitFor(() => expect(screen.getByText('Players wait for Table 3. Take them off its list first.')).toBeDefined());
  });
});

describe('a table made or changed in the panel (redesign RD-17)', () => {
  it('fills a new table\'s minimum buy-in at 50 big blinds of the stake chosen, until the admin types their own, and saves it', async () => {
    const sent = renderTables();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New table' }));
    const panel = screen.getByRole('dialog', { name: 'New table' });
    expect(within(panel).getByRole('radiogroup', { name: 'Seats' }).textContent).toBe('2345678910');
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Table name' }), { target: { value: 'Table 6' } });
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 100/200' }));
    expect(minBuyIn(panel).getAttribute('value')).toBe('10000');
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 50/100' }));
    expect(minBuyIn(panel).getAttribute('value')).toBe('5000');
    fireEvent.change(minBuyIn(panel), { target: { value: '7350' } });
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 100/200' }));
    expect(minBuyIn(panel).getAttribute('value')).toBe('7350');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual([{ rpc: 'add_game_table', body: { p_venue_id: 'v1', p_name: 'Table 6', p_table_type_id: 's1', p_seats: 9, p_min_buy_in_paise: 735000 } }]));
    await waitFor(() => expect(screen.getByText('Table 6 added, closed.')).toBeDefined());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a table from its Change on its own values, and keeps its own minimum while its stake stays', async () => {
    const sent = renderTables();
    fireEvent.click(screen.getByRole('button', { name: 'Change table Table 3' }));
    const panel = screen.getByRole('dialog', { name: 'Change table Table 3' });
    expect(within(panel).getByRole('textbox', { name: 'Table name' }).getAttribute('value')).toBe('Table 3');
    expect(minBuyIn(panel).getAttribute('value')).toBe('7350');
    // Another stake brings its suggestion; back on its own stake, the table's own figure, not that stake's 50 big blinds.
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 50/100' }));
    expect(minBuyIn(panel).getAttribute('value')).toBe('5000');
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 100/200' }));
    expect(minBuyIn(panel).getAttribute('value')).toBe('7350');
    fireEvent.click(within(panel).getByRole('radio', { name: '6' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual([{ rpc: 'set_game_table', body: { p_table_id: 't3', p_name: 'Table 3', p_table_type_id: 's1', p_seats: 6, p_min_buy_in_paise: 735000 } }]));
    await waitFor(() => expect(screen.getByText('Table 3 saved.')).toBeDefined());
  });

  it('says what is missing, refuses a minimum of nothing or one that is no whole 50, and a stake with no call time, before anything is sent', async () => {
    const sent = renderTables();
    fireEvent.click(screen.getByRole('button', { name: 'New table' }));
    const panel = screen.getByRole('dialog', { name: 'New table' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Check the name, stake and minimum buy-in.')).toBeDefined();
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Table name' }), { target: { value: 'Table 6' } });
    // Editing a field takes the refusal away until the next Save.
    expect(within(panel).queryByText('Check the name, stake and minimum buy-in.')).toBeNull();
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 500/1000' }));
    expect(minBuyIn(panel).getAttribute('value')).toBe('50000');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('That stake has no call time. Give it one first.')).toBeDefined();
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 100/200' }));
    expect(within(panel).getByText('In whole 50s.')).toBeDefined();
    fireEvent.change(minBuyIn(panel), { target: { value: '7349' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Check the name, stake and minimum buy-in.')).toBeDefined();
    fireEvent.change(minBuyIn(panel), { target: { value: '0' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Check the name, stake and minimum buy-in.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('closes the panel on Escape with the focus back on the row\'s Change, and sends one request when Save is pressed twice', async () => {
    const sent = renderTables();
    const change = screen.getByRole('button', { name: 'Change table Table 3' });
    change.focus();
    fireEvent.click(change);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Change table Table 3' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(change));
    expect(sent).toEqual([]);
    fireEvent.click(change);
    const save = within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText('Table 3 saved.')).toBeDefined());
    expect(sent.map((call) => call.rpc)).toEqual(['set_game_table']);
  });

  it('says why the database refused a table given a stake that lost its call time meanwhile', async () => {
    renderTables({ add_game_table: 'RVNCT' });
    fireEvent.click(screen.getByRole('button', { name: 'New table' }));
    const panel = screen.getByRole('dialog', { name: 'New table' });
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Table name' }), { target: { value: 'Table 6' } });
    fireEvent.click(within(panel).getByRole('radio', { name: 'NLH 100/200' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(panel).getByText('That stake has no call time. Give it one first.')).toBeDefined());
  });
});
