import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { A_DAY_TO_COME, openPanel, renderArea } from './settingsTestApi.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const VENUE = '00000000-0000-4000-8000-000000000001';
const rowOf = (name: string) => screen.getAllByRole('row').find((one) => one.textContent?.startsWith(name) === true);

describe('a tab of Settings in its groups (redesign RD-18)', () => {
  it('says it is loading, then lists each setting under its group, with its one line, and leaves out a setting with no group', async () => {
    renderArea('floor');
    expect(screen.getByRole('status').textContent).toBe('Loading');
    await screen.findByText('Seat hold', {}, { timeout: 5000 });
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Seating', 'Identity']);
    expect(within(screen.getByRole('table', { name: 'Seating' })).getByText('How long a called seat is held')).toBeDefined();
    expect(screen.queryByText('Dealer rotation')).toBeNull();
  });

  it('says so when the settings could not be read, with Retry', async () => {
    renderArea('floor', { keys: () => Response.json({ message: 'down' }, { status: 500 }) });
    expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toContain('Settings could not be loaded.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('holds the KYC switch under Floor, in Identity, a super admin\'s to change, and a search for KYC finds it (decision 0502)', async () => {
    renderArea('floor', { isSuperAdmin: true });
    await screen.findByText('Identity (KYC) checked at the club', {}, { timeout: 5000 });
    expect(within(screen.getByRole('table', { name: 'Identity' })).getByText('Super admin')).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a setting' }), { target: { value: 'KYC' } });
    expect(screen.getByText('Identity (KYC) checked at the club')).toBeDefined();
    expect(screen.queryByText('Seat hold')).toBeNull();
    cleanup();
    renderArea('members', { isSuperAdmin: true });
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
    renderArea('floor', { rows: [{ id: 's1', key: 'waitlist.hold_minutes', subject: '', value: { minutes: 25 }, effective_from: `${A_DAY_TO_COME}T12:30:00+00:00`, reason: 'Busier nights', creator: null }] });
    await screen.findByText('Seat hold', {}, { timeout: 5000 });
    expect(within(rowOf('Seat hold') ?? document.body).getByText(/^From .*, 18:00: 25 minutes$/)).toBeDefined();
  });

  it('gives an admin History on a super admin\'s setting: the same panel to read, with no form and nothing to withdraw', async () => {
    renderArea('members', { rows: [
      { id: 'b1', key: 'bonus.daily_staff_cap', subject: '', value: { chips: 10000 }, effective_from: '2026-01-01T00:00:00+00:00', reason: 'Opening', creator: { full_name: 'Leela Menon' } },
      { id: 'b2', key: 'bonus.daily_staff_cap', subject: '', value: { chips: 20000 }, effective_from: `${A_DAY_TO_COME}T12:30:00+00:00`, reason: 'Diwali week', creator: null },
    ] });
    expect(await screen.findByText('Super admin', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Change / })).toBeNull();
    const panel = await openPanel('Daily Bonus limit', 'History of');
    expect(panel.getByRole('heading', { name: 'In force' }).nextElementSibling?.textContent).toMatch(/^10,000 · Since .* · by Leela Menon · Opening$/);
    expect(panel.getByText(/^From .*, 18:00: 20,000$/)).toBeDefined();
    expect(panel.getByRole('heading', { name: 'Before' })).toBeDefined();
    expect(panel.queryByRole('button', { name: /^Withdraw/ })).toBeNull();
    expect(panel.queryByRole('button', { name: 'Save change' })).toBeNull();
    expect(panel.queryByRole('textbox')).toBeNull();
  });

  it('gives a super admin Change on the same setting', async () => {
    renderArea('members', { isSuperAdmin: true });
    expect(await screen.findByRole('button', { name: 'Change Daily Bonus limit' }, { timeout: 5000 })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^History of/ })).toBeNull();
  });
});

describe('a setting changed in the panel on the right (redesign RD-18)', () => {
  it('opens the panel named for the setting, its one line under the name: the new value, when, why, then in force, to come and before', async () => {
    renderArea('floor');
    const panel = await openPanel('Seat hold');
    expect(panel.getByText('How long a called seat is held')).toBeDefined();
    expect(panel.getByRole('textbox', { name: 'Minutes' })).toHaveProperty('value', '20');
    expect(panel.getByText('Between 1 and 120 minutes. A stepped-away place is kept as long.')).toBeDefined();
    expect(panel.getByRole('textbox', { name: 'Reason, 3 characters or more' })).toBeDefined();
    expect(panel.getByRole('radiogroup', { name: 'Takes effect' })).toBeDefined();
    expect(panel.getByRole('heading', { name: 'In force' }).nextElementSibling?.textContent).toBe('20 minutes (default)');
    expect(panel.getByRole('heading', { name: 'Changes to come' })).toBeDefined();
    expect(panel.getByRole('heading', { name: 'Before' })).toBeDefined();
  });

  it('closes with Cancel, in the panel\'s foot beside Save, and gives the focus back to the row\'s Change', async () => {
    renderArea('floor');
    const change = await screen.findByRole('button', { name: 'Change Seat hold' }, { timeout: 5000 });
    change.focus();
    fireEvent.click(change);
    const panel = within(await screen.findByRole('dialog', { name: 'Seat hold' }));
    expect(panel.getByRole('button', { name: 'Save change' }).parentElement).toBe(panel.getByRole('button', { name: 'Cancel' }).parentElement);
    fireEvent.click(panel.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change Seat hold' })));
  });

  it('says Not set in the panel only where a rule has no default, and what a value means under its field (audit F-031)', async () => {
    renderArea('members', { isSuperAdmin: true });
    const panel = await openPanel('Daily Bonus limit');
    expect(panel.getByRole('heading', { name: 'In force' }).nextElementSibling?.textContent).toBe('Not set');
    expect(panel.getByText(/Super admins have no limit\. No limit unless set\.$/)).toBeDefined();
  });

  it('says a reason under 3 characters is too short before anything is sent, then saves from now, once however often Save is pressed', async () => {
    const { written } = renderArea('floor');
    const panel = await openPanel('Seat hold');
    fireEvent.change(panel.getByRole('textbox', { name: 'Minutes' }), { target: { value: '15' } });
    fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'ok' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    expect(await panel.findByText('Say why, in 3 to 200 characters.')).toBeDefined();
    expect(written).toEqual([]);

    fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busy' } });
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    expect(await panel.findByText('Change saved.')).toBeDefined();
    expect(written).toEqual([expect.objectContaining({ venue_id: VENUE, key: 'waitlist.hold_minutes', value: { minutes: 15 }, reason: 'Busy' })]);
  });

  it('refuses a day and time that are past or not a time, so a change never goes backwards, and saves one to come', async () => {
    const { written } = renderArea('floor');
    const panel = await openPanel('Seat hold');
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

  it('says a refusal of the moment beside When, of the value beside its field, and clears it when the day, the time or When is edited', async () => {
    const reply = vi.fn(() => Response.json({ code: '23505', message: 'taken' }, { status: 409 }));
    renderArea('floor', { reply });
    const panel = await openPanel('Seat hold');
    const taken = 'A change already starts then. Withdraw it first.';
    const saveAgain = async () => {
      fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
      return panel.findByText(taken);
    };
    fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busy nights' } });
    fireEvent.click(panel.getByRole('radio', { name: 'From a day and time' }));
    fireEvent.change(panel.getByLabelText('Day'), { target: { value: A_DAY_TO_COME } });
    fireEvent.change(panel.getByRole('textbox', { name: 'Time' }), { target: { value: '18:00' } });
    // Beside When: before the reason, not at the foot of the form.
    expect((await saveAgain()).compareDocumentPosition(panel.getByRole('textbox', { name: /^Reason/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(panel.getByRole('textbox', { name: 'Time' }), { target: { value: '19:00' } });
    expect(panel.queryByText(taken)).toBeNull();
    await saveAgain();
    fireEvent.change(panel.getByLabelText('Day'), { target: { value: '2030-01-01' } });
    expect(panel.queryByText(taken)).toBeNull();
    await saveAgain();
    fireEvent.click(panel.getByRole('radio', { name: 'Now' }));
    expect(panel.queryByText(taken)).toBeNull();

    reply.mockImplementation(() => Response.json({ code: '23514', message: 'check' }, { status: 400 }));
    fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
    const refusedValue = await panel.findByText("Value refused. Check each field's limits.");
    expect(refusedValue.compareDocumentPosition(panel.getByRole('radiogroup', { name: 'Takes effect' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
