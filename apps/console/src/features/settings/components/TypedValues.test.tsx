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

describe('Call time, one typed value per stake (redesign RD-19)', () => {
  it('says each stake\'s call time on its own line in the row, and saves only the stakes whose value changed', async () => {
    const written = renderFloor([inForce('call_time.minutes', 'nlh-50-100', { minutes: 180 })]);
    expect(await screen.findByText('NLH 50/100 3 h', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openPanel('Minimum playing time');
    expect(panel.getByText('Least time at the table, per stake')).toBeDefined();
    const stakes = within(panel.getByRole('group', { name: 'Minimum playing time' }));
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
    const panel = await openPanel('Minimum playing time');
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
    const panel = await openPanel('Minimum playing time');
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
    const panel = await openPanel('Minimum playing time');
    fireEvent.change(panel.getByRole('textbox', { name: 'NLH 50/100' }), { target: { value: '240' } });
    fireEvent.change(panel.getByRole('textbox', { name: 'NLH 100/200' }), { target: { value: '240' } });
    fireEvent.click(panel.getByRole('radio', { name: 'From a day and time' }));
    fireEvent.change(panel.getByLabelText('Day'), { target: { value: A_DAY_TO_COME } });
    fireEvent.change(panel.getByRole('textbox', { name: 'Time' }), { target: { value: '18:00' } });
    save(panel);
    await waitFor(() => expect(written).toEqual([expect.objectContaining({ subject: 'nlh-100-200', value: { minutes: 240 }, effective_from: `${A_DAY_TO_COME}T12:30:00.000Z` })]));
  });
});
