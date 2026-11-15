import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { A_DAY_TO_COME, inForce, openPanel, renderArea, save, TIME_KEYS } from './settingsTestApi.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** An admin on Settings' Floor tab, where Time at the table is, with the values given in force. */
const renderFloor = (rows: readonly unknown[], reply?: () => Response) => renderArea('floor', { rows, keys: () => Response.json(TIME_KEYS), ...(reply === undefined ? {} : { reply }) }).written;

describe('Add time choices, a list of typed lengths (redesign RD-19)', () => {
  it('starts from what the club runs on, and adds, edits and removes a length', async () => {
    const written = renderFloor([]);
    expect(await screen.findByText('30 min, 1 h and 2 h (default)', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openPanel('Add time choices');
    const list = within(panel.getByRole('group', { name: 'Lengths offered' }));
    expect(list.getAllByRole('textbox').map((field) => field.getAttribute('value'))).toEqual(['30', '60', '120']);
    fireEvent.click(list.getByRole('button', { name: 'Remove Choice 1' }));
    fireEvent.change(list.getByRole('textbox', { name: 'Choice 1' }), { target: { value: '50' } });
    fireEvent.click(list.getByRole('button', { name: 'Add a choice' }));
    fireEvent.change(list.getByRole('textbox', { name: 'Choice 3' }), { target: { value: '200' } });
    save(panel);
    await waitFor(() => expect(written).toEqual([expect.objectContaining({ key: 'call_time.add_choices', subject: '', value: { minutes: [50, 120, 200] } })]));
  });

  it('saves nothing while a length is refused, or once none is left', async () => {
    const written = renderFloor([]);
    const panel = await openPanel('Add time choices');
    const list = within(panel.getByRole('group', { name: 'Lengths offered' }));
    fireEvent.change(list.getByRole('textbox', { name: 'Choice 1' }), { target: { value: '1441' } });
    expect(list.getByText('Between 1 and 1,440 minutes.')).toBeDefined();
    save(panel);
    for (const name of ['Remove Choice 3', 'Remove Choice 2', 'Remove Choice 1']) fireEvent.click(list.getByRole('button', { name }));
    save(panel);
    expect(await panel.findByText('Add at least one.')).toBeDefined();
    expect(written).toEqual([]);
  });

  it('holds twelve at most, and says so before Save', async () => {
    renderFloor([inForce('call_time.add_choices', '', { minutes: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110] })]);
    const panel = await openPanel('Add time choices');
    const add = panel.getByRole('button', { name: 'Add a choice' });
    expect(panel.queryByText('12 at most.')).toBeNull();
    fireEvent.click(add);
    expect(add).toHaveProperty('disabled', true);
    expect(panel.getByText('12 at most.')).toBeDefined();
  });

  it('carries over the choices ticked before, kept as text', async () => {
    renderFloor([inForce('call_time.add_choices', '', { minutes: ['45', '90'] })]);
    expect(await screen.findByText('45 min and 1 h 30 min', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openPanel('Add time choices');
    expect(within(panel.getByRole('group', { name: 'Lengths offered' })).getAllByRole('textbox').map((field) => field.getAttribute('value'))).toEqual(['45', '90']);
  });
});

describe('Call time, one typed value per stake (redesign RD-19)', () => {
  it('says each stake\'s call time on its own line in the row, and saves only the stakes whose value changed', async () => {
    const written = renderFloor([inForce('call_time.minutes', 'nlh-50-100', { minutes: 180 })]);
    expect(await screen.findByText('NLH 50/100 3 h', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openPanel('Call time');
    expect(panel.getByText('Least time at the table, per stake')).toBeDefined();
    const stakes = within(panel.getByRole('group', { name: 'Call time' }));
    expect(stakes.getByRole('textbox', { name: 'NLH 50/100' }).getAttribute('value')).toBe('180');
    expect(stakes.getByRole('textbox', { name: 'NLH 100/200' }).getAttribute('value')).toBe('');
    save(panel);
    expect(await panel.findByText('Nothing changed.')).toBeDefined();
    fireEvent.change(stakes.getByRole('textbox', { name: 'NLH 100/200' }), { target: { value: '240' } });
    expect(panel.queryByText('Nothing changed.')).toBeNull();
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(written).toEqual([expect.objectContaining({ key: 'call_time.minutes', subject: 'nlh-100-200', value: { minutes: 240 } })]));
  });

  it('saves nothing while a stake holds a time it refuses', async () => {
    const written = renderFloor([inForce('call_time.minutes', 'nlh-50-100', { minutes: 180 })]);
    const panel = await openPanel('Call time');
    fireEvent.change(panel.getByRole('textbox', { name: 'NLH 50/100' }), { target: { value: '0' } });
    expect(panel.getByText('Between 1 and 1,440 minutes.')).toBeDefined();
    save(panel);
    await waitFor(() => expect(panel.getByRole('button', { name: 'Save change' })).toBeDefined());
    expect(written).toEqual([]);
  });

  it('shows no stake since deleted: not in the row, not in the form, not among the stakes whose history it offers', async () => {
    renderFloor([
      inForce('call_time.minutes', 'nlh-50-100', { minutes: 180 }), inForce('call_time.minutes', 'plo-old', { minutes: 300 }),
      { ...inForce('call_time.minutes', 'plo-old', { minutes: 360 }), id: 'old-to-come', effective_from: `${A_DAY_TO_COME}T12:30:00+00:00` },
    ]);
    const row = (await screen.findByText('NLH 50/100 3 h', {}, { timeout: 5000 })).closest('[role="row"]');
    expect(row?.textContent).not.toContain('plo-old');
    expect(row?.textContent).toContain('–');
    const panel = await openPanel('Call time');
    expect(panel.queryByRole('textbox', { name: 'plo-old' })).toBeNull();
    expect(panel.queryByRole('radio', { name: 'plo-old' })).toBeNull();
    expect(panel.getByRole('radio', { name: 'NLH 50/100' })).toBeDefined();
  });

  it('says a change to come for each stake under its moment, and on Save again sends only the stakes not yet saved for that moment', async () => {
    const moment = `${A_DAY_TO_COME}T12:30:00+00:00`;
    const written = renderFloor([
      inForce('call_time.minutes', 'nlh-50-100', { minutes: 180 }), inForce('call_time.minutes', 'nlh-100-200', { minutes: 180 }),
      { ...inForce('call_time.minutes', 'nlh-50-100', { minutes: 240 }), id: 'saved-first', effective_from: moment },
    ]);
    const row = (await screen.findByText('NLH 50/100 4 h', {}, { timeout: 5000 })).closest('[role="row"]');
    expect(within(row instanceof HTMLElement ? row : document.body).getByText(/^From .*, 18:00:$/)).toBeDefined();
    // The first stake was saved for that moment and the second refused: both are typed again, and only the second is sent.
    const panel = await openPanel('Call time');
    fireEvent.change(panel.getByRole('textbox', { name: 'NLH 50/100' }), { target: { value: '240' } });
    fireEvent.change(panel.getByRole('textbox', { name: 'NLH 100/200' }), { target: { value: '240' } });
    fireEvent.click(panel.getByRole('radio', { name: 'From a day and time' }));
    fireEvent.change(panel.getByLabelText('Day'), { target: { value: A_DAY_TO_COME } });
    fireEvent.change(panel.getByRole('textbox', { name: 'Time' }), { target: { value: '18:00' } });
    save(panel);
    await waitFor(() => expect(written).toEqual([expect.objectContaining({ subject: 'nlh-100-200', value: { minutes: 240 }, effective_from: `${A_DAY_TO_COME}T12:30:00.000Z` })]));
  });
});
