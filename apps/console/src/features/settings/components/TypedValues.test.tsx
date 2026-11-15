import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RulesArea } from './RulesArea.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const VENUE = '00000000-0000-4000-8000-000000000001';

const KEYS = [
  { key: 'call_time.minutes', description: 'Call time', scope: 'table_type',
    value_schema: { type: 'object', properties: { minutes: { type: 'integer', minimum: 0, maximum: 1440 } }, required: ['minutes'] } },
  { key: 'call_time.add_choices', description: 'Add time choices', scope: 'venue',
    value_schema: { type: 'object', properties: { minutes: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'integer', minimum: 1, maximum: 1440 } } }, required: ['minutes'] } },
];
const STAKES = [{ code: 'nlh-50-100', name: 'NLH 50/100' }, { code: 'nlh-100-200', name: 'NLH 100/200' }];
const inForce = (key: string, subject: string, value: unknown) => ({ id: `${key}:${subject}`, key, subject, value, effective_from: '2026-01-01T00:00:00+00:00', reason: 'Opening', creator: null });

/** An admin on Settings' Floor tab, with the values given in force; every setting written is kept. */
function renderFloor(rows: readonly unknown[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const written: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/setting_key')) return Response.json(KEYS);
    if (url.includes('/rest/v1/table_type')) return Response.json(STAKES);
    if (url.includes('/rest/v1/setting') && init?.method === 'POST') {
      written.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 201 });
    }
    return Response.json(url.includes('/rest/v1/setting?') ? rows : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RulesArea venueId={VENUE} area="floor" isSuperAdmin={false} />
    </RivrDataProvider>,
  );
  return written;
}

/** Opens a setting's change and gives its panel. */
async function openChange(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Change ${name}` }, { timeout: 5000 }));
  return within(await screen.findByRole('dialog', { name }));
}

/** Gives the reason and presses Save. */
function save(panel: ReturnType<typeof within>) {
  fireEvent.change(panel.getByRole('textbox', { name: /^Reason/ }), { target: { value: 'Busier nights' } });
  fireEvent.click(panel.getByRole('button', { name: 'Save change' }));
}

describe('Add time choices, a list of typed lengths (redesign RD-19)', () => {
  it('starts from what the club runs on, and adds, edits and removes a length', async () => {
    const written = renderFloor([]);
    expect(await screen.findByText('30 min, 1 h and 2 h (default)', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openChange('Add time choices');
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
    const panel = await openChange('Add time choices');
    const list = within(panel.getByRole('group', { name: 'Lengths offered' }));
    fireEvent.change(list.getByRole('textbox', { name: 'Choice 1' }), { target: { value: '1441' } });
    expect(list.getByText('Between 1 and 1,440 minutes.')).toBeDefined();
    save(panel);
    for (const name of ['Remove Choice 3', 'Remove Choice 2', 'Remove Choice 1']) fireEvent.click(list.getByRole('button', { name }));
    save(panel);
    expect(await panel.findByText('Too few or too many. Add or remove one.')).toBeDefined();
    expect(written).toEqual([]);
  });

  it('carries over the choices ticked before, kept as text', async () => {
    renderFloor([inForce('call_time.add_choices', '', { minutes: ['45', '90'] })]);
    expect(await screen.findByText('45 min and 1 h 30 min', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openChange('Add time choices');
    expect(within(panel.getByRole('group', { name: 'Lengths offered' })).getAllByRole('textbox').map((field) => field.getAttribute('value'))).toEqual(['45', '90']);
  });
});

describe('Call time, one typed value per stake (redesign RD-19)', () => {
  it('says each stake\'s call time in its row, and saves only the stakes whose value changed', async () => {
    const written = renderFloor([inForce('call_time.minutes', 'nlh-50-100', { minutes: 180 })]);
    expect(await screen.findByText('NLH 50/100 3 h', {}, { timeout: 5000 })).toBeDefined();
    const panel = await openChange('Call time');
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
    const panel = await openChange('Call time');
    fireEvent.change(panel.getByRole('textbox', { name: 'NLH 50/100' }), { target: { value: '0' } });
    expect(panel.getByText('Between 1 and 1,440 minutes.')).toBeDefined();
    save(panel);
    await waitFor(() => expect(panel.getByRole('button', { name: 'Save change' })).toBeDefined());
    expect(written).toEqual([]);
  });
});
