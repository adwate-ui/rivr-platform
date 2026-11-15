import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderSetup, rowOf, stake, table } from './setupTestApi.tsx';
import { StakesBlock } from './StakesBlock.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const STAKES = [
  stake('s1', 'NLH 100/200'),
  stake('s2', 'Private Room', { straddle: 50000n, callTimeMinutes: 240 }),
  stake('s3', 'PLO 200/400', { smallBlind: 20000n, bigBlind: 40000n, callTimeMinutes: 0 }),
];
// Four tables play 100/200, one the Private Room, none the PLO.
const TABLES = [table('t1', 'Table 1'), table('t2', 'Table 2'), table('t3', 'Table 3'), table('t4', 'Table 4'), table('t6', 'Private Room', { stakeId: 's2' })];

const renderStakes = (refusals: Record<string, string> = {}, { stakes = STAKES, canSetCallTime = true } = {}) =>
  renderSetup(<StakesBlock venueId="v1" stakes={stakes} tables={TABLES} canSetCallTime={canSetCallTime} />, refusals);

/** Types into a field of the panel. */
const type = (panel: HTMLElement, field: string | RegExp, value: string) => fireEvent.change(within(panel).getByRole('textbox', { name: field }), { target: { value } });

describe('the stakes on Tables setup (redesign RD-17)', () => {
  it('lists each stake with its blinds, the straddle written with them, its call time and how many tables play it', () => {
    renderStakes();
    expect(rowOf('NLH 100/200').textContent).toContain('100/200');
    expect(rowOf('NLH 100/200').textContent).toContain('4 tables');
    expect(rowOf('Private Room').textContent).toContain('100/200/500');
    expect(rowOf('Private Room').textContent).toContain('1 table');
    expect(rowOf('Private Room').textContent).toMatch(/4 h/);
    // No call time and no tables: a dash each, never "None".
    expect(within(rowOf('PLO 200/400')).getAllByRole('cell').map((cell) => cell.textContent).slice(2, 5)).toEqual(['–', '–', '–']);
  });

  it('opens a new stake in the panel at the side, and a save of half a form says what is missing', async () => {
    const sent = renderStakes();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New stake' }));
    const panel = screen.getByRole('dialog', { name: 'New stake' });
    expect(within(panel).getByText('Blinds in whole 50s.')).toBeDefined();
    expect(within(panel).queryByRole('group', { name: 'Game' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Check the name, blinds, straddle and call time.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('asks for the call time with the stake, refuses a straddle not above the big blind, and saves the whole stake', async () => {
    const sent = renderStakes();
    fireEvent.click(screen.getByRole('button', { name: 'New stake' }));
    const panel = screen.getByRole('dialog', { name: 'New stake' });
    type(panel, 'Stake name', '100/200');
    type(panel, 'Small blind', '100');
    type(panel, 'Big blind', '200');
    type(panel, /^Straddle/, '200');
    type(panel, 'Call time', '240');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Check the name, blinds, straddle and call time.')).toBeDefined();
    expect(sent).toEqual([]);

    type(panel, /^Straddle/, '400');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual([{ rpc: 'add_table_type', body: {
      p_venue_id: 'v1', p_name: '100/200', p_small_blind_paise: 10000, p_big_blind_paise: 20000, p_straddle_paise: 40000, p_call_time_minutes: 240,
    } }]));
    await waitFor(() => expect(screen.getByText('100/200 added.')).toBeDefined());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses a stake with no call time, or one outside a day, before anything is sent', async () => {
    const sent = renderStakes();
    fireEvent.click(screen.getByRole('button', { name: 'New stake' }));
    const panel = screen.getByRole('dialog', { name: 'New stake' });
    type(panel, 'Stake name', '100/200');
    type(panel, 'Small blind', '100');
    type(panel, 'Big blind', '200');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(await within(panel).findByText('Check the name, blinds, straddle and call time.')).toBeDefined();
    // Editing a field takes the refusal away until the next Save.
    type(panel, 'Call time', '1441');
    expect(within(panel).queryByText('Check the name, blinds, straddle and call time.')).toBeNull();
    expect(within(panel).getByText('Between 1 and 1,440 minutes.')).toBeDefined();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    expect(sent).toEqual([]);
  });

  it('changes a stake from its row: the panel opens on its own values, its call time among them', async () => {
    const sent = renderStakes();
    fireEvent.click(within(rowOf('Private Room')).getByRole('button', { name: 'Change stake Private Room' }));
    const panel = screen.getByRole('dialog', { name: 'Change stake Private Room' });
    expect(['Stake name', 'Small blind', 'Big blind', /^Straddle/, 'Call time'].map((field) => within(panel).getByRole('textbox', { name: field }).getAttribute('value')))
      .toEqual(['Private Room', '100', '200', '500', '240']);
    type(panel, 'Call time', '300');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual([{ rpc: 'set_table_type', body: {
      p_type_id: 's2', p_name: 'Private Room', p_small_blind_paise: 10000, p_big_blind_paise: 20000, p_straddle_paise: 50000, p_call_time_minutes: 300,
    } }]));
    await waitFor(() => expect(screen.getByText('Private Room saved.')).toBeDefined());
  });

  it('deletes a stake no table uses, asked first, and dims Delete on one a table plays', async () => {
    const sent = renderStakes();
    fireEvent.click(screen.getByRole('button', { name: 'More for NLH 100/200' }));
    const used = screen.getByRole('menuitem', { name: 'Delete · In use' });
    expect(used.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(used);
    fireEvent.click(screen.getByRole('button', { name: 'More for NLH 100/200' }));
    fireEvent.click(screen.getByRole('button', { name: 'More for PLO 200/400' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete PLO 200/400' }));
    await waitFor(() => expect(screen.getByText('PLO 200/400 deleted.')).toBeDefined());
    expect(sent).toEqual([{ rpc: 'delete_table_type', body: { p_type_id: 's3' } }]);
  });

  it('opens the new stake panel by itself while the club has no stakes', () => {
    renderStakes({}, { stakes: [] });
    expect(screen.getByRole('dialog', { name: 'New stake' })).toBeDefined();
    expect(screen.getByText('No stakes yet.')).toBeDefined();
  });

  it('closes the panel on Escape and gives the focus back to the row\'s Change', async () => {
    renderStakes();
    const change = within(rowOf('Private Room')).getByRole('button', { name: 'Change stake Private Room' });
    change.focus();
    fireEvent.click(change);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Change stake Private Room' }), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(change));
  });

  it('sends one request when Save is pressed twice', async () => {
    const sent = renderStakes();
    fireEvent.click(within(rowOf('Private Room')).getByRole('button', { name: 'Change stake Private Room' }));
    const save = within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText('Private Room saved.')).toBeDefined());
    expect(sent.map((call) => call.rpc)).toEqual(['set_table_type']);
  });

  it('says the call time is not theirs to staff who do not change settings, and saves the stake without one', async () => {
    const sent = renderStakes({}, { canSetCallTime: false });
    fireEvent.click(screen.getByRole('button', { name: 'New stake' }));
    const panel = screen.getByRole('dialog', { name: 'New stake' });
    expect(within(panel).queryByRole('textbox', { name: 'Call time' })).toBeNull();
    expect(within(panel).getByText('Call time: not in your role. Ask an admin.')).toBeDefined();
    type(panel, 'Stake name', '300/600');
    type(panel, 'Small blind', '300');
    type(panel, 'Big blind', '600');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent).toEqual([{ rpc: 'add_table_type', body: { p_venue_id: 'v1', p_name: '300/600', p_small_blind_paise: 30000, p_big_blind_paise: 60000 } }]));
  });

  it('says why the database refused a delete: a deleted table\'s history still uses the stake', async () => {
    renderStakes({ delete_table_type: 'RVUSE' });
    fireEvent.click(screen.getByRole('button', { name: 'More for PLO 200/400' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete PLO 200/400' }));
    await waitFor(() => expect(screen.getByText('PLO 200/400 is still used by a table or its history. Not deleted.')).toBeDefined());
  });
});
